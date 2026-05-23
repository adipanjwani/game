import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Helper to get Monday of a given week (for week calculation)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // If Sunday (0), go back 6 days. Otherwise go back (day - 1) days
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper to get Sunday of a given week
function getWeekEnd(date: Date): Date {
  const monday = getWeekStart(date)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return sunday
}

// GET - Check if PIN is clocked in
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const pin = request.nextUrl.searchParams.get("pin")
    
    if (!pin) {
      // Return all active clock-ins (for backwards compatibility)
      const { data: activeClockins, error } = await supabase
        .from("time_clock")
        .select("id, staff_id, clock_in")
        .is("clock_out", null)
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(activeClockins || [])
    }
    
    // Find staff by PIN
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, name")
      .eq("pin", pin)
      .eq("is_active", true)
      .single()
    
    if (staffError || !staff) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 })
    }
    
    // Check if clocked in
    const { data: activeClockin } = await supabase
      .from("time_clock")
      .select("id, clock_in")
      .eq("staff_id", staff.id)
      .is("clock_out", null)
      .single()
    
    return NextResponse.json({
      staffId: staff.id,
      staffName: staff.name,
      isClockedIn: !!activeClockin,
      clockInTime: activeClockin?.clock_in || null
    })
  } catch (error) {
    console.error("Error in time-clock API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Clock in or clock out using PIN only
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { pin, action } = await request.json()
    
    if (!pin || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    
    // Find staff by PIN
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, name")
      .eq("pin", pin)
      .eq("is_active", true)
      .single()
    
    if (staffError || !staff) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 })
    }
    
    if (action === "clock_in") {
      // Check if already clocked in
      const { data: existingClockin } = await supabase
        .from("time_clock")
        .select("id")
        .eq("staff_id", staff.id)
        .is("clock_out", null)
        .single()
      
      if (existingClockin) {
        return NextResponse.json({ error: "Already clocked in" }, { status: 400 })
      }
      
      // Create new clock-in record
      const { data: newClockin, error: insertError } = await supabase
        .from("time_clock")
        .insert({
          staff_id: staff.id,
          clock_in: new Date().toISOString()
        })
        .select()
        .single()
      
      if (insertError) {
        console.error("Error clocking in:", insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
      
      return NextResponse.json({ 
        success: true, 
        action: "clock_in",
        staffName: staff.name,
        message: `Welcome, ${staff.name}!`,
        clockin: newClockin 
      })
      
    } else if (action === "clock_out") {
      // Find active clock-in record
      const { data: activeClockin, error: findError } = await supabase
        .from("time_clock")
        .select("id, clock_in")
        .eq("staff_id", staff.id)
        .is("clock_out", null)
        .single()
      
      if (findError || !activeClockin) {
        return NextResponse.json({ error: "Not clocked in" }, { status: 400 })
      }
      
      const clockOutTime = new Date()
      const clockInTime = new Date(activeClockin.clock_in)
      
      // Update with clock-out time
      const { error: updateError } = await supabase
        .from("time_clock")
        .update({ clock_out: clockOutTime.toISOString() })
        .eq("id", activeClockin.id)
      
      if (updateError) {
        console.error("Error clocking out:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
      
      // Calculate shift hours
      const shiftMs = clockOutTime.getTime() - clockInTime.getTime()
      const shiftHours = shiftMs / (1000 * 60 * 60)
      
      // Calculate weekly hours (week based on clock_in day, Mon-Sun)
      const weekStart = getWeekStart(clockInTime)
      const weekEnd = getWeekEnd(clockInTime)
      
      // Fetch all completed shifts for this staff in the same week (based on clock_in date)
      const { data: weekShifts, error: weekError } = await supabase
        .from("time_clock")
        .select("clock_in, clock_out")
        .eq("staff_id", staff.id)
        .gte("clock_in", weekStart.toISOString())
        .lte("clock_in", weekEnd.toISOString())
        .not("clock_out", "is", null)
      
      let weeklyHours = 0
      if (!weekError && weekShifts) {
        weeklyHours = weekShifts.reduce((total, shift) => {
          const inTime = new Date(shift.clock_in).getTime()
          const outTime = new Date(shift.clock_out).getTime()
          return total + (outTime - inTime) / (1000 * 60 * 60)
        }, 0)
      }
      
      return NextResponse.json({ 
        success: true, 
        action: "clock_out",
        staffName: staff.name,
        message: `Goodbye, ${staff.name}!`,
        shiftDate: clockInTime.toISOString(),
        shiftHours: shiftHours,
        weeklyHours: weeklyHours,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString()
      })
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error in time-clock API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
