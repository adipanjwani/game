import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Verify PIN and get staff info + current clock status
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { pin, action } = body

  if (!pin) {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 })
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

  // Check if staff is currently clocked in (has a record with no clock_out)
  const { data: activeShift } = await supabase
    .from("time_clock")
    .select("*")
    .eq("staff_id", staff.id)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .single()

  // If action is specified, perform clock in/out
  if (action === "clock_in") {
    if (activeShift) {
      return NextResponse.json({ 
        error: "Already clocked in",
        staff,
        activeShift 
      }, { status: 400 })
    }

    const { data: newShift, error: clockError } = await supabase
      .from("time_clock")
      .insert({ 
        staff_id: staff.id, 
        clock_in: new Date().toISOString() 
      })
      .select()
      .single()

    if (clockError) {
      return NextResponse.json({ error: clockError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: "Clocked in successfully",
      staff,
      activeShift: newShift
    })
  }

  if (action === "clock_out") {
    if (!activeShift) {
      return NextResponse.json({ 
        error: "Not clocked in",
        staff 
      }, { status: 400 })
    }

    const { data: updatedShift, error: clockError } = await supabase
      .from("time_clock")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", activeShift.id)
      .select()
      .single()

    if (clockError) {
      return NextResponse.json({ error: clockError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: "Clocked out successfully",
      staff,
      completedShift: updatedShift
    })
  }

  // Just return status if no action
  return NextResponse.json({
    staff,
    isClockedIn: !!activeShift,
    activeShift
  })
}

// Get time clock records (for admin/statistics)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const staffId = searchParams.get("staffId")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  let query = supabase
    .from("time_clock")
    .select(`
      *,
      staff:staff_id (id, name)
    `)
    .order("clock_in", { ascending: false })

  if (staffId) {
    query = query.eq("staff_id", staffId)
  }

  if (startDate) {
    query = query.gte("clock_in", startDate)
  }

  if (endDate) {
    query = query.lte("clock_in", endDate)
  }

  const { data: records, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(records)
}
