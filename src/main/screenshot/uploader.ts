import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { db } from '../db/client'
import { screenshotQueue } from '../db/schema'
import { eq, lt } from 'drizzle-orm'
import * as Sentry from '@sentry/electron/main'

const MAX_ATTEMPTS = 10

/**
 * Derives the screenshot upload URL from the Solidtime instance endpoint.
 * e.g. https://time.expertstudio.ai → https://time.expertstudio.ai/screenshots/upload
 */
function getUploadUrl(endpoint: string): string {
    const base = endpoint.replace(/\/+$/, '')
    return `${base}/screenshots/upload`
}

export interface UploadParams {
    buffer: Buffer
    timeEntryId: string
    organizationId: string
    token: string
    endpoint: string
    capturedAt: string
    displayIndex: number
}

export async function uploadScreenshot(params: UploadParams): Promise<boolean> {
    try {
        const uploadUrl = getUploadUrl(params.endpoint)
        const formData = new FormData()
        const blob = new Blob([params.buffer], { type: 'image/jpeg' })
        formData.append('screenshot', blob, `screenshot_${params.displayIndex}.jpg`)
        formData.append('time_entry_id', params.timeEntryId)
        formData.append('organization_id', params.organizationId)
        formData.append('captured_at', params.capturedAt)
        formData.append('display_index', String(params.displayIndex))

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${params.token}` },
            body: formData,
        })

        return response.ok
    } catch (error) {
        console.error('Screenshot: upload failed:', error)
        return false
    }
}

async function queueScreenshot(params: UploadParams): Promise<void> {
    const tempDir = path.join(app.getPath('userData'), 'screenshot-queue')
    await fs.mkdir(tempDir, { recursive: true })

    const fileName = `${Date.now()}_${params.displayIndex}.jpg`
    const filePath = path.join(tempDir, fileName)
    await fs.writeFile(filePath, params.buffer)

    await db.insert(screenshotQueue).values({
        filePath,
        timeEntryId: params.timeEntryId,
        organizationId: params.organizationId,
        token: params.token,
        endpoint: params.endpoint,
        capturedAt: params.capturedAt,
        displayIndex: params.displayIndex,
        attemptCount: 0,
        createdAt: new Date().toISOString(),
    })
}

export async function uploadAndQueue(params: UploadParams): Promise<void> {
    const success = await uploadScreenshot(params)
    if (!success) {
        await queueScreenshot(params)
    }
}

export async function retryQueuedUploads(): Promise<void> {
    try {
        const queued = await db
            .select()
            .from(screenshotQueue)
            .where(lt(screenshotQueue.attemptCount, MAX_ATTEMPTS))
            .limit(10)

        for (const item of queued) {
            try {
                const buffer = await fs.readFile(item.filePath)
                const success = await uploadScreenshot({
                    buffer,
                    timeEntryId: item.timeEntryId,
                    organizationId: item.organizationId,
                    token: item.token,
                    endpoint: item.endpoint,
                    capturedAt: item.capturedAt,
                    displayIndex: item.displayIndex,
                })

                if (success) {
                    await db.delete(screenshotQueue).where(eq(screenshotQueue.id, item.id))
                    await fs.unlink(item.filePath).catch(() => {})
                } else {
                    await db
                        .update(screenshotQueue)
                        .set({ attemptCount: item.attemptCount + 1 })
                        .where(eq(screenshotQueue.id, item.id))
                }
            } catch (err) {
                console.error(`Screenshot: retry failed for queue item ${item.id}:`, err)
                Sentry.captureException(err, { tags: { context: 'retryQueuedUploads' } })
            }
        }
    } catch (error) {
        console.error('Screenshot: retryQueuedUploads failed:', error)
    }
}
