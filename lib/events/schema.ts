import { z } from 'zod'

// Matches the event_color enum in supabase/migrations/0001_ivy_hive_init.sql
export const EVENT_COLORS = ['sage', 'forest', 'honey', 'tan'] as const

export const createEventSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().max(2000).optional().nullable(),
    start_time: z.string().datetime({ message: 'start_time must be an ISO 8601 date' }),
    end_time: z.string().datetime({ message: 'end_time must be an ISO 8601 date' }),
    color_tag: z.enum(EVENT_COLORS).default('sage'),
    // RFC5545 RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10".
    // Further validated with isValidRecurrenceRule() in recurrence.ts
    // before it's trusted, since zod can't parse RRULE syntax itself.
    recurrence_rule: z.string().max(500).optional().nullable(),
  })
  .refine((data) => new Date(data.end_time) > new Date(data.start_time), {
    message: 'end_time must be after start_time',
    path: ['end_time'],
  })

export const updateEventSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
    color_tag: z.enum(EVENT_COLORS).optional(),
    recurrence_rule: z.string().max(500).optional().nullable(),
  })
  .refine(
    (data) =>
      !data.start_time || !data.end_time || new Date(data.end_time) > new Date(data.start_time),
    { message: 'end_time must be after start_time', path: ['end_time'] }
  )

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
