import type { SupabaseClient } from '@supabase/supabase-js'
import { expandEvent, type EventInstance, type EventRow } from './recurrence'
import type { CreateEventInput, UpdateEventInput } from './schema'

export interface DayBucket {
  date: string // YYYY-MM-DD (UTC)
  events: EventInstance[]
}

export interface EventsInRangeResult {
  range: { start: string; end: string }
  days: DayBucket[]
}

function toDayKey(iso: string): string {
  return iso.slice(0, 10) // relies on start_time being stored/returned in UTC ISO form
}

/** Every UTC calendar-day key from rangeStart up to (and including) rangeEnd's day. */
function enumerateDayKeys(rangeStart: Date, rangeEnd: Date): string[] {
  const keys: string[] = []
  const cursor = new Date(
    Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate())
  )
  const lastDay = new Date(
    Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), rangeEnd.getUTCDate())
  )
  while (cursor <= lastDay) {
    keys.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return keys
}

/**
 * Fetches every event that could intersect [rangeStart, rangeEnd), expands
 * recurring events into concrete instances, and groups everything by
 * calendar day — ready to hand straight to a week/month grid component
 * (each day in the range gets an entry, even if its `events` array is
 * empty, so the UI never has to compute missing days itself).
 *
 * Recurring events can start long before the visible range, so we can't
 * filter purely on start_time >= rangeStart. Instead: fetch non-recurring
 * events that overlap the range normally (end_time > rangeStart AND
 * start_time < rangeEnd), OR any recurring event whose *series* could
 * still be active (recurrence_rule is not null), bounded by a lookback
 * window so one ancient recurring event doesn't force a full table scan.
 */
export async function getEventsInRange(
  supabase: SupabaseClient,
  userId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<EventsInRangeResult> {
  const LOOKBACK_DAYS = 365
  const lookbackStart = new Date(rangeStart)
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - LOOKBACK_DAYS)

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', lookbackStart.toISOString())
    .lt('start_time', rangeEnd.toISOString())
    .or(`end_time.gt.${rangeStart.toISOString()},recurrence_rule.not.is.null`)

  if (error) throw error

  const rows = (data ?? []) as EventRow[]

  const dayMap = new Map<string, EventInstance[]>()
  for (const key of enumerateDayKeys(rangeStart, rangeEnd)) {
    dayMap.set(key, [])
  }

  for (const row of rows) {
    for (const instance of expandEvent(row, rangeStart, rangeEnd)) {
      const key = toDayKey(instance.start_time)
      if (!dayMap.has(key)) dayMap.set(key, [])
      dayMap.get(key)!.push(instance)
    }
  }

  const days: DayBucket[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({
      date,
      events: events.sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }))

  return { range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() }, days }
}

export async function getEventById(supabase: SupabaseClient, userId: string, id: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as EventRow | null
}

export async function createEvent(
  supabase: SupabaseClient,
  userId: string,
  input: CreateEventInput
) {
  const { data, error } = await supabase
    .from('events')
    .insert({ ...input, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data as EventRow
}

export async function updateEvent(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateEventInput
) {
  const { data, error } = await supabase
    .from('events')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error) throw error
  return data as EventRow | null
}

export async function deleteEvent(supabase: SupabaseClient, userId: string, id: string) {
  const { error, count } = await supabase
    .from('events')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
  return (count ?? 0) > 0
}
