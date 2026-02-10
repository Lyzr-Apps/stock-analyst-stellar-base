import { NextRequest, NextResponse } from 'next/server'

const SCHEDULER_BASE_URL = 'https://scheduler.studio.lyzr.ai'
const LYZR_API_KEY = process.env.LYZR_API_KEY || ''

/**
 * GET /api/scheduler?schedule_id=xxx
 * Fetch schedule status
 */
export async function GET(request: NextRequest) {
  try {
    if (!LYZR_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'LYZR_API_KEY not configured on server' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('schedule_id')

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: 'schedule_id is required' },
        { status: 400 }
      )
    }

    const res = await fetch(`${SCHEDULER_BASE_URL}/schedules/${scheduleId}`, {
      headers: { 'x-api-key': LYZR_API_KEY },
    })

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Scheduler API returned status ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/scheduler
 * Handles: toggle (pause/resume), create new schedule
 *
 * Body for toggle: { action: "pause" | "resume", schedule_id: "xxx" }
 * Body for create: { action: "create", agent_id, cron_expression, timezone, message, max_retries, retry_delay }
 */
export async function POST(request: NextRequest) {
  try {
    if (!LYZR_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'LYZR_API_KEY not configured on server' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { action } = body

    if (action === 'pause' || action === 'resume') {
      const { schedule_id } = body
      if (!schedule_id) {
        return NextResponse.json(
          { success: false, error: 'schedule_id is required' },
          { status: 400 }
        )
      }

      const res = await fetch(
        `${SCHEDULER_BASE_URL}/schedules/${schedule_id}/${action}`,
        {
          method: 'POST',
          headers: { 'x-api-key': LYZR_API_KEY },
        }
      )

      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: `Failed to ${action} schedule` },
          { status: res.status }
        )
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'create') {
      const { agent_id, cron_expression, timezone, message, max_retries, retry_delay } = body

      if (!agent_id || !cron_expression) {
        return NextResponse.json(
          { success: false, error: 'agent_id and cron_expression are required' },
          { status: 400 }
        )
      }

      const res = await fetch(`${SCHEDULER_BASE_URL}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LYZR_API_KEY,
        },
        body: JSON.stringify({
          agent_id,
          cron_expression,
          timezone: timezone || 'America/New_York',
          message: message || '',
          max_retries: max_retries ?? 3,
          retry_delay: retry_delay ?? 300,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        return NextResponse.json(
          { success: false, error: `Failed to create schedule: ${errorText}` },
          { status: res.status }
        )
      }

      const data = await res.json()
      return NextResponse.json({ success: true, data })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "pause", "resume", or "create"' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/scheduler?schedule_id=xxx
 * Delete a schedule
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!LYZR_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'LYZR_API_KEY not configured on server' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('schedule_id')

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: 'schedule_id is required' },
        { status: 400 }
      )
    }

    const res = await fetch(`${SCHEDULER_BASE_URL}/schedules/${scheduleId}`, {
      method: 'DELETE',
      headers: { 'x-api-key': LYZR_API_KEY },
    })

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to delete schedule: status ${res.status}` },
        { status: res.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}
