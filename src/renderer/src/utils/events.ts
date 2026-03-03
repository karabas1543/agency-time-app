export async function listenForBackendEvent(event: string, callback: () => void) {
    if (event === 'startTimer') {
        window.electronAPI.onStartTimer(() => {
            callback()
        })
    }
    if (event === 'stopTimer') {
        window.electronAPI.onStopTimer(() => {
            callback()
        })
    }
    if (event === 'pauseTimer') {
        window.electronAPI.onPauseTimer(() => {
            callback()
        })
    }
    if (event === 'resumeTimer') {
        window.electronAPI.onResumeTimer(() => {
            callback()
        })
    }
}

export async function sendEventToWindow(_: string, event: string) {
    if (event === 'startTimer') {
        window.electronAPI.startTimer()
    }
    if (event === 'stopTimer') {
        window.electronAPI.stopTimer()
    }
    if (event === 'pauseTimer') {
        window.electronAPI.pauseTimer()
    }
    if (event === 'resumeTimer') {
        window.electronAPI.resumeTimer()
    }
}
