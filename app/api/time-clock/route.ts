import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get("staffId")

    if (staffId) {
      // Get time entries for a specific staff member
      const { data: entries, error } = await supabase
        .from("time_clock")
        .select("*")
        .eq("staff_id", staffId)
        .order("clock_in", { ascending: false })

      if (error) {
        console.error("[v0] Supabase error fetching time entries:", error)
        return NextResponse.json({ error: "Failed to fetch time entries" }, { status: 500 })
      }

      return NextResponse.json({ entries: entries || [] })
    }

    // Get all time entries
    const { data: entries, error } = await supabase
      .from("time_clock")
      .select("*, staff:staff_id(id, name)")
      .order("clock_in", { ascending: false })

    if (error) {
      console.error("[v0] Supabase error fetching time entries:", error)
      return NextResponse.json({ error: "Failed to fetch time entries" }, { status: 500 })
    }

    return NextResponse.json({ entries: entries || [] })
  } catch (error) {
    console.error("[v0] Error fetching time entries:", error)
    return NextResponse.json({ error: "Failed to fetch time entries" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { pin, action } = body as { pin: string; action: "clock_in" | "clock_out" }

    if (!pin || !action) {
      return NextResponse.json({ error: "PIN and action are required" }, { status: 400 })
    }

    // Find staff by PIN
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .eq("pin", pin)
      .eq("is_active", true)
      .single()

    if (staffError || !staff) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 })
    }

    if (action === "clock_in") {
      // Check if already clocked in (has an open entry with no clock_out)
      const { data: openEntry } = await supabase
        .from("time_clock")
        .select("*")
        .eq("staff_id", staff.id)
        .is("clock_out", null)
        .single()

      if (openEntry) {
        return NextResponse.json({ 
          error: "Already clocked in", 
          staff: { id: staff.id, name: staff.name },
          clockedIn: true 
        }, { status: 400 })
      }

      // Create new time entry
      const { data: entry, error } = await supabase
        .from("time_clock")
        .insert({
          staff_id: staff.id,
          clock_in: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error("[v0] Supabase error creating time entry:", error)
        return NextResponse.json({ error: "Failed to clock in" }, { status: 500 })
      }

      // Calculate weekly hours
      const weeklyHours = await calculateWeeklyHours(supabase, staff.id)

      return NextResponse.json({ 
        success: true, 
        action: "clock_in",
        staff: { id: staff.id, name: staff.name },
        entry,
        weeklyHours
      })
    }

    if (action === "clock_out") {
      // Find the open entry
      const { data: openEntry, error: findError } = await supabase
        .from("time_clock")
        .select("*")
        .eq("staff_id", staff.id)
        .is("clock_out", null)
        .single()

      if (findError || !openEntry) {
        return NextResponse.json({ 
          error: "Not clocked in", 
          staff: { id: staff.id, name: staff.name },
          clockedIn: false 
        }, { status: 400 })
      }

      // Update with clock out time
      const { data: entry, error } = await supabase
        .from("time_clock")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", openEntry.id)
        .select()
        .single()

      if (error) {
        console.error("[v0] Supabase error updating time entry:", error)
        return NextResponse.json({ error: "Failed to clock out" }, { status: 500 })
      }

      // Calculate shift duration
      const clockIn = new Date(openEntry.clock_in)
      const clockOut = new Date()
      const durationMs = clockOut.getTime() - clockIn.getTime()
      const durationHours = Math.floor(durationMs / (1000 * 60 * 60))
      const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

      // Calculate weekly hours
      const weeklyHours = await calculateWeeklyHours(supabase, staff.id)

      return NextResponse.json({ 
        success: true, 
        action: "clock_out",
        staff: { id: staff.id, name: staff.name },
        entry,
        shiftDuration: { hours: durationHours, minutes: durationMinutes },
        weeklyHours
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("[v0] Error processing time clock:", error)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}

async function calculateWeeklyHours(supabase: Awaited<ReturnType<typeof createClient>>, staffId: string) {
  // Get start of current week (Sunday)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek)
  startOfWeek.setHours(0, 0, 0, 0)

  const { data: entries } = await supabase
    .from("time_clock")
    .select("*")
    .eq("staff_id", staffId)
    .gte("clock_in", startOfWeek.toISOString())

  if (!entries || entries.length === 0) {
    return { hours: 0, minutes: 0 }
  }

  let totalMs = 0
  for (const entry of entries) {
    const clockIn = new Date(entry.clock_in)
    const clockOut = entry.clock_out ? new Date(entry.clock_out) : new Date()
    totalMs += clockOut.getTime() - clockIn.getTime()
  }

  const hours = Math.floor(totalMs / (1000 * 60 * 60))
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60))

  return { hours, minutes }
}
