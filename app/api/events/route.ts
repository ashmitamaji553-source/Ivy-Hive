import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEventSchema } from '@/lib/events/schema'
import { isValidRecurrenceRule } from '@/lib/events/recurrence'
import { getEventsInRange, createEvent } from '@/lib/events/queries'

/**
 * GET /api/events?start=2026-07-13T00:00:00.000Z&end=2026-07-20T00:00:00.000Z
 *
 * Returns every event in [start, end) — recurring events expanded into
 * concrete instances — grouped by day, ready for a week/month calendar
 * grid. This is the query the calendar view should call whenever the
 * visible date range changes.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: 'Both "start" and "end" query params (ISO 8601 dates) are required.' },
      { status: 400 }
    )
  }

  const rangeStart = new Date(startParam)
  const rangeEnd = new Date(endParam)

  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return NextResponse.json({ error: 'Invalid "start" or "end" date.' }, { status: 400 })
  }
  if (rangeEnd <= rangeStart) {
    return NextResponse.json({ error: '"end" must be after "start".' }, { status: 400 })
  }

  try {
    const result = await getEventsInRange(supabase, user.id, rangeStart, rangeEnd)
    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/events failed', err)
    return NextResponse.json({ error: 'Failed to load events.' }, { status: 500 })
  }
}

/**
 * POST /api/events
 * Body: { title, description?, start_time, end_time, color_tag?, recurrence_rule? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.recurrence_rule && !isValidRecurrenceRule(parsed.data.recurrence_rule)) {
    return NextResponse.json({ error: 'Invalid recurrence_rule.' }, { status: 400 })
  }

  try {
    const event = await createEvent(supabase, user.id, parsed.data)
    return NextResponse.json(event, { status: 201 })
  } catch (err) {
    console.error('POST /api/events failed', err)
    return NextResponse.json({ error: 'Failed to create event.' }, { status: 500 })
  }
}
