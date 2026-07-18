import { RRule } from 'rrule'

export interface EventRow {
  id: string
  user_id: string
  title: string
  description: string | null
  start_time: string // ISO 8601
  end_time: string // ISO 8601
  color_tag: string
  recurrence_rule: string | null
  created_at: string
}

/**
 * One concrete, calendar-grid-ready occurrence of an event. For a
 * non-recurring event this is just the event itself. For a recurring
 * event, one of these is produced per occurrence within the query range.
 */
export interface EventInstance {
  id: string // stable per-instance id (see note on `event_id` below)
  event_id: string // the underlying events.id row this instance came from
  title: string
  description: string | null
  start_time: string // ISO 8601, this occurrence's actual start
  end_time: string // ISO 8601, this occurrence's actual end
  color_tag: string
  recurrence_rule: string | null
  is_recurring_instance: boolean
}

// Safety cap in case a rule is missing both COUNT and UNTIL and the query
// range is huge — keeps one bad row from generating unbounded instances.
const MAX_INSTANCES_PER_EVENT = 500

/**
 * Returns true if `rule` is a parseable RRULE string. Use this to validate
 * recurrence_rule on write (POST/PATCH), so a malformed rule never makes
 * it into the database in the first place.
 */
export function isValidRecurrenceRule(rule: string): boolean {
  try {
    RRule.parseString(rule)
    return true
  } catch {
    return false
  }
}

function overlaps(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return start < rangeEnd && end > rangeStart
}

function toSingleInstance(event: EventRow, start: Date, end: Date): EventInstance {
  return {
    id: event.id,
    event_id: event.id,
    title: event.title,
    description: event.description,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    color_tag: event.color_tag,
    recurrence_rule: event.recurrence_rule,
    is_recurring_instance: false,
  }
}

/**
 * Expands one `events` row into the concrete instances that fall within
 * [rangeStart, rangeEnd). Non-recurring events produce zero or one
 * instance depending on overlap. Recurring events are expanded via RRule
 * against the stored RFC5545 recurrence_rule (FREQ=DAILY|WEEKLY|MONTHLY,
 * optionally with INTERVAL / COUNT / UNTIL / BYDAY), anchored at the
 * event's own start_time as DTSTART.
 *
 * Each instance keeps `event_id` pointing at the original row, and
 * recurring instances get a synthetic `id` of `${event.id}::${isoStart}`
 * so the UI can key them uniquely in a calendar grid. Note this means
 * editing/deleting a *single instance* of a recurring event (rather than
 * the whole series) isn't supported by this schema — that needs EXDATE/
 * RDATE exception tracking, which is a reasonable next step but out of
 * scope here.
 */
export function expandEvent(event: EventRow, rangeStart: Date, rangeEnd: Date): EventInstance[] {
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)
  const durationMs = end.getTime() - start.getTime()

  if (!event.recurrence_rule) {
    return overlaps(start, end, rangeStart, rangeEnd) ? [toSingleInstance(event, start, end)] : []
  }

  let rule: RRule
  try {
    const options = RRule.parseString(event.recurrence_rule)
    rule = new RRule({ ...options, dtstart: start })
  } catch {
    // Malformed rule somehow got stored — fail closed as a single
    // occurrence rather than throwing and breaking the whole range query.
    return overlaps(start, end, rangeStart, rangeEnd) ? [toSingleInstance(event, start, end)] : []
  }

  // Search slightly before rangeStart too, so a long-running occurrence
  // that starts just before the visible range but still overlaps into it
  // isn't missed.
  const searchStart = new Date(rangeStart.getTime() - durationMs)
  const occurrenceStarts = rule.between(searchStart, rangeEnd, true).slice(0, MAX_INSTANCES_PER_EVENT)

  const instances: EventInstance[] = []
  for (const occurrenceStart of occurrenceStarts) {
    const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs)
    if (!overlaps(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) continue

    instances.push({
      id: `${event.id}::${occurrenceStart.toISOString()}`,
      event_id: event.id,
      title: event.title,
      description: event.description,
      start_time: occurrenceStart.toISOString(),
      end_time: occurrenceEnd.toISOString(),
      color_tag: event.color_tag,
      recurrence_rule: event.recurrence_rule,
      is_recurring_instance: true,
    })
  }

  return instances
}
