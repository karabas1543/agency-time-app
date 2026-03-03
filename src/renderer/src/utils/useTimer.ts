import { computed } from 'vue'
import { useStorage } from '@vueuse/core'
import type { TimeEntry, CreateTimeEntryBody } from '@solidtime/api'
import {
    emptyTimeEntry,
    useTimeEntryStopMutation,
    useTimeEntryCreateMutation,
} from './timeEntries.ts'
import { currentMembershipId, useMyMemberships } from './myMemberships.ts'
import { dayjs } from './dayjs.ts'

// Module-level session state — shared across all composable instances via localStorage
export const sessionStart = useStorage('timerSessionStart', '')
export const sessionAccumulated = useStorage('timerSessionAccumulated', 0)

/**
 * Composable for managing timer state and operations
 * Provides shared logic for starting/stopping timers across components
 * NOTE: This should only be used in the renderer process (browser context)
 */
export function useTimer() {
    // Access current time entry from storage (only works in browser context)
    const currentTimeEntry = useStorage<TimeEntry>(
        'currentTimeEntry',
        { ...emptyTimeEntry },
        typeof window !== 'undefined' ? localStorage : undefined
    )
    const lastTimeEntry = useStorage<TimeEntry>(
        'lastTimeEntry',
        { ...emptyTimeEntry },
        typeof window !== 'undefined' ? localStorage : undefined
    )

    // Get mutations for timer operations
    const timeEntryStop = useTimeEntryStopMutation()
    const timeEntryCreate = useTimeEntryCreateMutation()

    const { memberships } = useMyMemberships()

    /**
     * Check if there's an active timer running
     */
    const isActive = computed(() => {
        if (currentTimeEntry.value) {
            return (
                currentTimeEntry.value.start !== '' &&
                currentTimeEntry.value.start !== null &&
                currentTimeEntry.value.end === null
            )
        }
        return false
    })

    /**
     * True when a session is paused (sessionStart set, but no active entry)
     */
    const isPaused = computed(() => !!sessionStart.value && !isActive.value)

    /**
     * Stop the current timer and clear session state
     * @param endTime - Optional end time (ISO string). If not provided, uses current time
     */
    async function stopTimer(endTime?: string) {
        sessionStart.value = ''
        sessionAccumulated.value = 0

        const stoppedTimeEntry = { ...currentTimeEntry.value }
        currentMembershipId.value = memberships.value.find(
            (membership) => membership.organization.id === stoppedTimeEntry.organization_id
        )?.id
        currentTimeEntry.value = { ...emptyTimeEntry }

        await timeEntryStop.mutateAsync({
            ...stoppedTimeEntry,
            end: endTime || dayjs().utc().format(),
        })
    }

    /**
     * Pause the current timer: accumulate elapsed time, stop the API entry
     */
    async function pauseTimer() {
        if (!isActive.value) return

        const nowUtc = dayjs().utc()
        const elapsed = nowUtc.diff(dayjs(currentTimeEntry.value.start), 'seconds')
        sessionAccumulated.value = (sessionAccumulated.value || 0) + elapsed

        const stoppedTimeEntry = { ...currentTimeEntry.value }
        currentMembershipId.value = memberships.value.find(
            (membership) => membership.organization.id === stoppedTimeEntry.organization_id
        )?.id
        currentTimeEntry.value = { ...emptyTimeEntry }

        await timeEntryStop.mutateAsync({
            ...stoppedTimeEntry,
            end: nowUtc.format(),
        })
    }

    /**
     * Resume a paused session by creating a new time entry with the same context
     */
    function resumeTimer() {
        if (isActive.value || !sessionStart.value) return

        const startTime = dayjs().utc().format()

        if (lastTimeEntry.value && lastTimeEntry.value.start) {
            currentTimeEntry.value = {
                ...emptyTimeEntry,
                project_id: lastTimeEntry.value.project_id,
                task_id: lastTimeEntry.value.task_id,
                description: lastTimeEntry.value.description,
                tags: lastTimeEntry.value.tags,
                billable: lastTimeEntry.value.billable,
                start: startTime,
            }
        } else {
            currentTimeEntry.value = {
                ...emptyTimeEntry,
                start: startTime,
            }
        }

        const timeEntryToCreate: CreateTimeEntryBody = {
            ...currentTimeEntry.value,
            member_id: currentMembershipId.value!,
        }
        timeEntryCreate.mutate(timeEntryToCreate)
    }

    /**
     * Start a new timer — resets session state
     * Copies properties from the last time entry if available
     */
    function startTimer() {
        sessionStart.value = dayjs().utc().format()
        sessionAccumulated.value = 0

        const startTime = dayjs().utc().format()

        if (lastTimeEntry.value && lastTimeEntry.value.start) {
            // Copy properties from last entry
            currentTimeEntry.value = {
                ...emptyTimeEntry,
                project_id: lastTimeEntry.value.project_id,
                task_id: lastTimeEntry.value.task_id,
                description: lastTimeEntry.value.description,
                tags: lastTimeEntry.value.tags,
                billable: lastTimeEntry.value.billable,
                start: startTime,
            }
        } else {
            // First timer - start fresh
            currentTimeEntry.value = {
                ...emptyTimeEntry,
                start: startTime,
            }
        }

        const timeEntryToCreate: CreateTimeEntryBody = {
            ...currentTimeEntry.value,
            member_id: currentMembershipId.value!,
        }
        timeEntryCreate.mutate(timeEntryToCreate)
    }

    return {
        currentTimeEntry,
        lastTimeEntry,
        isActive,
        isPaused,
        stopTimer,
        startTimer,
        pauseTimer,
        resumeTimer,
        timeEntryStop,
        timeEntryCreate,
    }
}
