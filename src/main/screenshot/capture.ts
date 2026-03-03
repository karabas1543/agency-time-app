import { desktopCapturer, screen } from 'electron'
import * as Sentry from '@sentry/electron/main'

export interface CapturedScreenshot {
    buffer: Buffer
    displayIndex: number
    capturedAt: string
}

const MAX_DIMENSION = 1920
const JPEG_QUALITY = 70

export async function captureAllScreens(): Promise<CapturedScreenshot[]> {
    try {
        const capturedAt = new Date().toISOString()

        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 3840, height: 2160 },
        })

        const results: CapturedScreenshot[] = []

        for (let i = 0; i < sources.length; i++) {
            try {
                const image = sources[i].thumbnail
                const { width, height } = image.getSize()

                if (width === 0 || height === 0) continue

                let finalImage = image
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    const scale = MAX_DIMENSION / Math.max(width, height)
                    finalImage = image.resize({
                        width: Math.round(width * scale),
                        height: Math.round(height * scale),
                        quality: 'better',
                    })
                }

                const buffer = finalImage.toJPEG(JPEG_QUALITY)
                results.push({ buffer, displayIndex: i, capturedAt })
            } catch (err) {
                console.error(`Screenshot: failed to capture display ${i}:`, err)
            }
        }

        return results
    } catch (error) {
        console.error('Screenshot: captureAllScreens failed:', error)
        Sentry.captureException(error, { tags: { context: 'captureAllScreens' } })
        return []
    }
}
