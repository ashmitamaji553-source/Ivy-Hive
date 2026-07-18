# Ivy-Hive — Events API

CRUD for the `events` table, with recurring events expanded into concrete
instances and results grouped by day for the calendar grid.

## Install

```bash
npm install rrule zod
```

## File map

```
lib/events/schema.ts       # zod validation for create/update payloads
lib/events/recurrence.ts   # expandEvent(): turns one row + RRULE into instances
lib/events/queries.ts      # getEventsInRange, createEvent, updateEvent, deleteEvent
lib/events/client.ts       # fetch() wrappers for use in Client Components
app/api/events/route.ts        # GET (range query) + POST (create)
app/api/events/[id]/route.ts   # GET one, PATCH, DELETE
```

## Endpoints

| Method | Path                  | Purpose                                    |
| ------ | --------------------- | ------------------------------------------- |
| GET    | `/api/events?start=&end=` | Events in range, expanded + grouped by day |
| POST   | `/api/events`          | Create an event                             |
| GET    | `/api/events/:id`      | Get one event (raw row, for edit forms)     |
| PATCH  | `/api/events/:id`      | Update an event                             |
| DELETE | `/api/events/:id`      | Delete an event                             |

All routes read the user from the Supabase session cookie (via
`lib/supabase/server.ts`) and return `401` if there isn't one. Row Level
Security on the `events` table (see `supabase/migrations/0001_ivy_hive_init.sql`)
is a second layer of protection — even if a route's own check were ever
skipped, Postgres itself won't return or modify another user's rows.

## Recurrence rule format

`recurrence_rule` is a standard RFC5545 `RRULE` string (no `RRULE:` prefix,
no `DTSTART` — that's implied by the event's own `start_time`):

```
FREQ=DAILY
FREQ=WEEKLY;BYDAY=MO,WE,FR
FREQ=WEEKLY;INTERVAL=2;COUNT=10
FREQ=MONTHLY;UNTIL=20261231T000000Z
```

Validated on write with `isValidRecurrenceRule()` (attempts to parse it via
the `rrule` library) and expanded on read with `expandEvent()`.

**Known limitation**: there's no per-occurrence exception tracking
(RFC5545's `EXDATE`/`RDATE`), so "edit or delete just this one occurrence
of a recurring event" isn't supported yet — PATCH/DELETE always act on the
whole series. Adding an `event_exceptions` table (goal_id/event_id +
excluded date) would be the natural next step if that's needed.

## Response shape (GET /api/events)

```jsonc
{
  "range": { "start": "2026-07-13T00:00:00.000Z", "end": "2026-07-20T00:00:00.000Z" },
  "days": [
    {
      "date": "2026-07-13",
      "events": [
        {
          "id": "a1b2c3::2026-07-13T15:00:00.000Z", // synthetic id for recurring instances
          "event_id": "a1b2c3",                      // the underlying events.id row
          "title": "Morning pages",
          "description": null,
          "start_time": "2026-07-13T08:00:00.000Z",
          "end_time": "2026-07-13T09:00:00.000Z",
          "color_tag": "sage",
          "recurrence_rule": "FREQ=DAILY",
          "is_recurring_instance": true
        }
      ]
    },
    { "date": "2026-07-14", "events": [] }
    // ...one entry per day in the range, even if empty
  ]
}
```

## Example requests

```bash
# Week view
curl "/api/events?start=2026-07-13T00:00:00.000Z&end=2026-07-20T00:00:00.000Z"

# Create a daily recurring event
curl -X POST /api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Morning pages",
    "start_time": "2026-07-13T08:00:00.000Z",
    "end_time": "2026-07-13T08:15:00.000Z",
    "color_tag": "sage",
    "recurrence_rule": "FREQ=DAILY"
  }'

# Update
curl -X PATCH /api/events/a1b2c3 \
  -H "Content-Type: application/json" \
  -d '{ "color_tag": "honey" }'

# Delete
curl -X DELETE /api/events/a1b2c3
```

From a Client Component, use the wrappers in `lib/events/client.ts` instead
of calling `fetch` directly:

```ts
import { fetchEventsInRange, createEventRequest } from '@/lib/events/client'

const { days } = await fetchEventsInRange(weekStart, weekEnd)

await createEventRequest({
  title: 'Deep work: roadmap',
  start_time: '2026-07-14T09:00:00.000Z',
  end_time: '2026-07-14T10:30:00.000Z',
  color_tag: 'forest',
})
```
