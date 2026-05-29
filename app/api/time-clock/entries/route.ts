import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET - Fetch time entries for a week
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get("weekStart")
    
    if (!weekStart) {
      return NextResponse.json({ error: "weekStart required" }, { status: 400 })
    }
    
    const startDate = new Date(weekStart)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)
    
    const { data: entries, error } = await supabase
      .from("time_clock")
      .select(`
        id,
        staff_id,
        clock_in,
        clock_out,
        staff:staff_id (name)
      `)
      .gte("clock_in", startDate.toISOString())
      .lt("clock_in", endDate.toISOString())
      .order("clock_in", { ascending: false })
    
    if (error) {
      console.error("Error fetching time entries:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Flatten the staff name
    const flattenedEntries = entries?.map(entry => ({
      id: entry.id,
      staff_id: entry.staff_id,
      clock_in: entry.clock_in,
      clock_out: entry.clock_out,
      staff_name: (entry.staff as { name: string } | null)?.name
    })) || []
    
    return NextResponse.json(flattenedEntries)
  } catch (error) {
    console.error("Error in time entries API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
