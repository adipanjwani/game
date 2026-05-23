import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET - Fetch current clock-in status for all staff
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get all active clock-ins (where clock_out is null)
    const { data: activeClockins, error } = await supabase
      .from("time_clock")
      .select("id, staff_id, clock_in")
      .is("clock_out", null)
    
    if (error) {
      console.error("Error fetching active clock-ins:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(activeClockins || [])
  } catch (error) {
    console.error("Error in time-clock API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Clock in or clock out
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { staffId, pin, action } = await request.json()
    
    if (!staffId || !pin || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    
    // Verify PIN
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, name, pin")
      .eq("id", staffId)
      .eq("is_active", true)
      .single()
    
    if (staffError || !staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }
    
    if (staff.pin !== pin) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 })
    }
    
    if (action === "clock_in") {
      // Check if already clocked in
      const { data: existingClockin } = await supabase
        .from("time_clock")
        .select("id")
        .eq("staff_id", staffId)
        .is("clock_out", null)
        .single()
      
      if (existingClockin) {
        return NextResponse.json({ error: "Already clocked in" }, { status: 400 })
      }
      
      // Create new clock-in record
      const { data: newClockin, error: insertError } = await supabase
        .from("time_clock")
        .insert({
          staff_id: staffId,
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
        message: `${staff.name} clocked in`,
        clockin: newClockin 
      })
      
    } else if (action === "clock_out") {
      // Find active clock-in record
      const { data: activeClockin, error: findError } = await supabase
        .from("time_clock")
        .select("id")
        .eq("staff_id", staffId)
        .is("clock_out", null)
        .single()
      
      if (findError || !activeClockin) {
        return NextResponse.json({ error: "Not clocked in" }, { status: 400 })
      }
      
      // Update with clock-out time
      const { error: updateError } = await supabase
        .from("time_clock")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", activeClockin.id)
      
      if (updateError) {
        console.error("Error clocking out:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `${staff.name} clocked out` 
      })
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error in time-clock API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
