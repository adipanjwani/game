import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDateParam = searchParams.get("startDate")
  const endDateParam = searchParams.get("endDate")

  if (!startDateParam || !endDateParam) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 })
  }

  const startDate = new Date(startDateParam)
  startDate.setHours(0, 0, 0, 0)
  
  const endDate = new Date(endDateParam)
  endDate.setHours(23, 59, 59, 999)

  try {
    // Fetch all staff members
    const { data: staffList, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .order("name")

    if (staffError) {
      console.error("Failed to fetch staff:", staffError)
      return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
    }

    // Fetch time clock records for the date range
    const { data: timeRecords, error: timeError } = await supabase
      .from("time_clock")
      .select("*")
      .gte("clock_in", startDate.toISOString())
      .lte("clock_in", endDate.toISOString())
      .order("clock_in")

    if (timeError) {
      console.error("Failed to fetch time records:", timeError)
      return NextResponse.json({ error: "Failed to fetch time records" }, { status: 500 })
    }

    // Generate array of days in the week
    const days: Date[] = []
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      days.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Process data for each staff member
    const rosterData = staffList.map((staff) => {
      const staffRecords = timeRecords.filter((r) => r.staff_id === staff.id)
      
      const daysData = days.map((day) => {
        const dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)

        const dayRecords = staffRecords.filter((r) => {
          const clockIn = new Date(r.clock_in)
          return clockIn >= dayStart && clockIn <= dayEnd
        })

        // Calculate total minutes for the day
        let totalMinutes = 0
        dayRecords.forEach((record) => {
          const clockIn = new Date(record.clock_in)
          const clockOut = record.clock_out ? new Date(record.clock_out) : new Date()
          totalMinutes += Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000)
        })

        return {
          date: day.toISOString(),
          records: dayRecords,
          totalMinutes,
        }
      })

      // Calculate week total
      const weekTotalMinutes = daysData.reduce((sum, d) => sum + d.totalMinutes, 0)

      return {
        staff,
        days: daysData,
        weekTotalMinutes,
      }
    })

    return NextResponse.json(rosterData)
  } catch (error) {
    console.error("Roster API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
