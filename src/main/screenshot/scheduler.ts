import { captureAllScreens } from './capture'
import { uploadAndQueue, retryQueuedUploads } from './uploader'
import { getAppSettings } from '../settings'
import { hasScreenRecordingPermission } from '../permissions'
import { logger } from '../logger'

const WINDOW_MS = 10 * 60 * 1000 // 10 minutes

let captureTimeout: ReturnType<typeof setTimeout> | null = null
let retryInterval: ReturnType<typeof setInterval> | null = null
let activeSession: { timeEntryId: string; organizationId: string; token: string; endpoint: string } | null = null

function scheduleNextCapture(): void {
    if (captureTimeout !== null) {
        clearTimeout(captureTimeout)
    }

    const delay = Math.floor(Math.random() * WINDOW_MS)
    logger.info(`Screenshot: next capture in ${Math.round(delay / 1000)}s`)

    captureTimeout = setTimeout(async () => {
        await doCapture()
        if (activeSession !== null) {
            scheduleNextCapture()
        }
    }, delay)
}

async function doCapture(): Promise<void> {
    if (!activeSession) return

    const settings = await getAppSettings()
    if (!settings.screenshotEnabled) {
        logger.info('Screenshot: capture skipped (disabled in settings)')
        return
    }

    if (!hasScreenRecordingPermission()) {
        logger.warn('Screenshot: capture skipped (screen recording permission not granted)')
        return
    }

    logger.info('Screenshot: capturing screens...')
    const screenshots = await captureAllScreens()
    const { timeEntryId, organizationId, token, endpoint } = activeSession

    for (const screenshot of screenshots) {
        await uploadAndQueue({
            buffer: screenshot.buffer,
            timeEntryId,
            organizationId,
            token,
            endpoint,
            capturedAt: screenshot.capturedAt,
            displayIndex: screenshot.displayIndex,
        })
    }

    logger.info(`Screenshot: captured ${screenshots.length} screen(s)`)
}

export function startScreenshotSchedule(
    timeEntryId: string,
    organizationId: string,
    token: string,
    endpoint: string
): void {
    activeSession = { timeEntryId, organizationId, token, endpoint }
    scheduleNextCapture()
    logger.info('Screenshot: schedule started for time_entry_id:', timeEntryId)
}

export function stopScreenshotSchedule(): void {
    activeSession = null
    if (captureTimeout !== null) {
        clearTimeout(captureTimeout)
        captureTimeout = null
    }
    logger.info('Screenshot: schedule stopped')
}

export function startRetryLoop(): void {
    if (retryInterval !== null) return
    retryInterval = setInterval(retryQueuedUploads, 5 * 60 * 1000)
    logger.info('Screenshot: retry loop started')
}

export function stopRetryLoop(): void {
    if (retryInterval !== null) {
        clearInterval(retryInterval)
        retryInterval = null
    }
}
