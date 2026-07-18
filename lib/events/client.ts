import type { EventsInRangeResult } from './queries'
import type { CreateEventInput, UpdateEventInput } from './schema'
import type { EventRow } from './recurrence'

async function parseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(typeof body?.error === 'string' ? body.error : 'Request failed')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/**
 * Fetches events for [start, end), grouped by day and with recurring
 * events already expanded — pass the result straight to a week/month
 * calendar grid component.
 */
export async function fetchEventsInRange(start: Date, end: Date): Promise<EventsInRangeResult> {
  const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() })
  const response = await fetch(`/api/events?${params}`)
  return parseOrThrow(response)
}

export async function createEventRequest(input: CreateEventInput): Promise<EventRow> {
  const response = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseOrThrow(response)
}

export async function updateEventRequest(id: string, input: UpdateEventInput): Promise<EventRow> {
  const response = await fetch(`/api/events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseOrThrow(response)
}

export async function deleteEventRequest(id: string): Promise<void> {
  const response = await fetch(`/api/events/${id}`, { method: 'DELETE' })
  return parseOrThrow(response)
}
