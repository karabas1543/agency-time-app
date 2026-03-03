import { ipcMain } from 'electron'
import {
    startScreenshotSchedule,
    stopScreenshotSchedule,
    startRetryLoop,
    stopRetryLoop,
} from './scheduler'
import { logger } from '../logger'

export function initializeScreenshotCapture(): void {
    startRetryLoop()

    ipcMain.on(
        'screenshotTimerStarted',
        (_event, timeEntryId: string, organizationId: string, token: string, endpoint: string) => {
            logger.info('Screenshot: timer started, scheduling captures')
            startScreenshotSchedule(timeEntryId, organizationId, token, endpoint)
        }
    )

    ipcMain.on('screenshotTimerStopped', () => {
        logger.info('Screenshot: timer stopped, cancelling captures')
        stopScreenshotSchedule()
    })
}

export function stopScreenshotCapture(): void {
    stopScreenshotSchedule()
    stopRetryLoop()
}
