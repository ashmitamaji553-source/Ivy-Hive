import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateEventSchema } from '@/lib/events/schema'
import { isValidRecurrenceRule } from '@/lib/events/recurrence'
import { getEventById, updateEvent, deleteEvent } from '@/lib/events/queries'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** GET /api/events/[id] — the raw event row (not expanded), for edit forms. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = await getEventById(supabase, user.id, id)
  if (!event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(event)
}

/**
 * PATCH /api/events/[id]
 * Body: any subset of { title, description, start_time, end_time,
 * color_tag, recurrence_rule }.
 *
 * Note: this updates the whole series for a recurring event — there's no
 * "edit just this occurrence" support here (that needs EXDATE/RDATE
 * exception tracking on top of the current schema).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.recurrence_rule && !isValidRecurrenceRule(parsed.data.recurrence_rule)) {
    return NextResponse.json({ error: 'Invalid recurrence_rule.' }, { status: 400 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  try {
    const updated = await updateEvent(supabase, user.id, id, parsed.data)
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/events/[id] failed', err)
    return NextResponse.json({ error: 'Failed to update event.' }, { status: 500 })
  }
}

/** DELETE /api/events/[id] — deletes the whole series if it's recurring. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const deleted = await deleteEvent(supabase, user.id, id)
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('DELETE /api/events/[id] failed', err)
    return NextResponse.json({ error: 'Failed to delete event.' }, { status: 500 })
  }
}
