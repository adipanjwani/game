import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface OrderItem {
  pizza?: { id: string; name: string }
  side?: { id: string; name: string }
  isFullPizza: boolean
  quantity: number
  baseType?: string
}

interface OrderRow {
  id: string
  items: OrderItem[]
  status: string
  created_at: string
  order_type: string
  order_number: string | null
}

// Store hours: 6pm (18:00) to 6am (06:00) next day
// A "business day" starts at 6pm and ends at 6am next day
function getBusinessDayStart(date: Date): Date {
  const d = new Date(date)
  // If before 6am, the business day started at 6pm the previous calendar day
  if (d.getHours() < 6) {
    d.setDate(d.getDate() - 1)
  }
  d.setHours(18, 0, 0, 0)
  return d
}

function getBusinessDayEnd(date: Date): Date {
  const start = getBusinessDayStart(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setHours(6, 0, 0, 0)
  return end
}

// Get start of business week (Monday 6pm)
function getBusinessWeekStart(date: Date): Date {
  const businessDayStart = getBusinessDayStart(date)
  const dayOfWeek = businessDayStart.getDay()
  // Adjust to Monday (1)
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(businessDayStart)
  weekStart.setDate(weekStart.getDate() - daysToSubtract)
  weekStart.setHours(18, 0, 0, 0)
  return weekStart
}

function getBusinessWeekEnd(date: Date): Date {
  const weekStart = getBusinessWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  weekEnd.setHours(6, 0, 0, 0)
  return weekEnd
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") || "day" // "day", "week", or "custom"
  const dateParam = searchParams.get("date") // ISO date string
  const startDateParam = searchParams.get("startDate") // ISO date string for custom range
  const endDateParam = searchParams.get("endDate") // ISO date string for custom range

  const referenceDate = dateParam ? new Date(dateParam) : new Date()
  
  let startDate: Date
  let endDate: Date

  if (period === "custom" && startDateParam && endDateParam) {
    // Custom date range - use business hours (6pm start, 6am end)
    startDate = new Date(startDateParam)
    startDate.setHours(18, 0, 0, 0)
    endDate = new Date(endDateParam)
    endDate.setDate(endDate.getDate() + 1)
    endDate.setHours(6, 0, 0, 0)
  } else if (period === "week") {
    startDate = getBusinessWeekStart(referenceDate)
    endDate = getBusinessWeekEnd(referenceDate)
  } else {
    startDate = getBusinessDayStart(referenceDate)
    endDate = getBusinessDayEnd(referenceDate)
  }

  try {
    // Fetch completed orders within the date range
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "completed")
      .gte("created_at", startDate.toISOString())
      .lt("created_at", endDate.toISOString())
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[v0] Supabase error:", error)
      return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 })
    }

    const typedOrders = (orders || []) as OrderRow[]

    // Process statistics
    const frontItems: Record<string, number> = {}
    const takeawayItems: Record<string, number> = {}
    let totalFrontOrders = 0
    let totalTakeawayOrders = 0

    typedOrders.forEach((order) => {
      const isTakeaway = order.order_type === "takeaway"
      const itemsMap = isTakeaway ? takeawayItems : frontItems

      if (isTakeaway) {
        totalTakeawayOrders++
      } else {
        totalFrontOrders++
      }

      order.items.forEach((item: OrderItem) => {
        const name = item.pizza?.name || item.side?.name || "Unknown"
        const quantity = item.quantity || 1
        const sizeLabel = item.pizza 
          ? item.isFullPizza ? " (Full)" : " (Half)"
          : ""
        const baseLabel = item.baseType 
          ? ` - ${item.baseType === "15-thick" ? "15\" Thick" : item.baseType === "15-thin" ? "15\" Thin" : "12\" Thin"}`
          : ""
        const key = `${name}${sizeLabel}${baseLabel}`
        
        itemsMap[key] = (itemsMap[key] || 0) + quantity
      })
    })

    // Sort items by quantity (descending)
    const sortedFrontItems = Object.entries(frontItems)
      .sort((a, b) => b[1] - a[1])
      .map(([name, quantity]) => ({ name, quantity }))

    const sortedTakeawayItems = Object.entries(takeawayItems)
      .sort((a, b) => b[1] - a[1])
      .map(([name, quantity]) => ({ name, quantity }))

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalOrders: typedOrders.length,
      frontOrders: {
        total: totalFrontOrders,
        items: sortedFrontItems,
      },
      takeawayOrders: {
        total: totalTakeawayOrders,
        items: sortedTakeawayItems,
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching statistics:", error)
    return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 })
  }
}
