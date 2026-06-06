"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Order } from "@/lib/pizza-data"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw, ChevronLeft, ChevronRight, Calendar } from "lucide-react"

// Store hours: 6:00 PM - 6:00 AM (next day)
const STORE_OPEN_HOUR = 18 // 6:00 PM
const STORE_CLOSE_HOUR = 6 // 6:00 AM next day

type ViewMode = "daily" | "weekly" | "custom"

function getBusinessDayStart(date: Date): Date {
  const d = new Date(date)
  // If current time is before 6 AM, we're still in yesterday's business day
  if (d.getHours() < STORE_CLOSE_HOUR) {
    d.setDate(d.getDate() - 1)
  }
  d.setHours(STORE_OPEN_HOUR, 0, 0, 0)
  return d
}

function getBusinessDayEnd(date: Date): Date {
  const d = new Date(date)
  // If current time is before 6 AM, we're still in yesterday's business day
  if (d.getHours() < STORE_CLOSE_HOUR) {
    d.setDate(d.getDate() - 1)
  }
  // End is 6 AM the next day
  d.setDate(d.getDate() + 1)
  d.setHours(STORE_CLOSE_HOUR, 0, 0, 0)
  return d
}

function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  })
}

export default function StatisticsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("daily")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders")
      const data = await res.json()
      if (data.orders) {
        setOrders(data.orders)
      }
      setIsLoading(false)
    } catch (error) {
      console.error("Failed to fetch orders:", error)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  // Calculate date range based on view mode
  const getDateRange = () => {
    const start = getBusinessDayStart(selectedDate)
    const end = getBusinessDayEnd(selectedDate)
    
    if (viewMode === "weekly") {
      // Get the start of the week (Sunday)
      const weekStart = new Date(start)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(STORE_OPEN_HOUR, 0, 0, 0)
      
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      weekEnd.setHours(STORE_CLOSE_HOUR, 0, 0, 0)
      
      return { start: weekStart, end: weekEnd }
    }
    
    return { start, end }
  }

  const { start: rangeStart, end: rangeEnd } = getDateRange()

  // Filter orders by date range, excluding cancelled orders
  const filteredOrders = orders.filter(order => {
    if (order.status === "cancelled") return false
    const orderDate = new Date(order.createdAt)
    return orderDate >= rangeStart && orderDate < rangeEnd
  })

  const frontOrders = filteredOrders.filter(o => o.orderType === "front" || !o.orderType)
  const takeawayOrders = filteredOrders.filter(o => o.orderType === "takeaway")

  // Calculate item breakdown
  const getItemBreakdown = (orderList: Order[]) => {
    const breakdown: Record<string, { count: number; name: string }> = {}
    
    orderList.forEach(order => {
      order.items.forEach(item => {
        const name = item.pizza?.name || item.side?.name || "Unknown"
        
        let countToAdd = 1
        
        // For pizzas: count half pizza as 0.5, full pizza as 1
        if (item.pizza) {
          countToAdd = item.isFullPizza ? 1 : 0.5
        }
        
        // For Kransky Dogs and Garlic Bread: count by quantity
        if (item.side && (item.side.id === "kransky-dog" || item.side.id === "garlic-bread")) {
          countToAdd = item.quantity || 1
        }
        
        if (breakdown[name]) {
          breakdown[name].count += countToAdd
        } else {
          breakdown[name] = { count: countToAdd, name }
        }
      })
    })
    
    return Object.values(breakdown).sort((a, b) => b.count - a.count)
  }

  const frontBreakdown = getItemBreakdown(frontOrders)
  const takeawayBreakdown = getItemBreakdown(takeawayOrders)

  // Calculate total pizzas sold (full = 1, half = 0.5, so two halves = one full)
  const getPizzasSold = (orderList: Order[]) => {
    let total = 0
    orderList.forEach(order => {
      order.items.forEach(item => {
        if (item.pizza) {
          total += item.isFullPizza ? 1 : 0.5
        }
      })
    })
    return total
  }

  const totalPizzasSold = getPizzasSold(filteredOrders)

  const navigateDate = (direction: number) => {
    const newDate = new Date(selectedDate)
    if (viewMode === "weekly") {
      newDate.setDate(newDate.getDate() + (direction * 7))
    } else {
      newDate.setDate(newDate.getDate() + direction)
    }
    setSelectedDate(newDate)
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Statistics</h1>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOrders} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </header>

        {/* View Mode & Date Selection */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          {/* View Mode Tabs */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={viewMode === "daily" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("daily")}
              className={viewMode === "daily" ? "bg-primary text-primary-foreground" : ""}
            >
              Daily
            </Button>
            <Button
              variant={viewMode === "weekly" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("weekly")}
              className={viewMode === "weekly" ? "bg-primary text-primary-foreground" : ""}
            >
              Weekly
            </Button>
            <Button
              variant={viewMode === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("custom")}
              className={viewMode === "custom" ? "bg-primary text-primary-foreground" : ""}
            >
              Custom Range
            </Button>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2 mb-3">
            <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(selectedDate)}
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate(1)} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Date Range Display */}
          <div className="text-sm text-muted-foreground">
            {formatDateRange(rangeStart, rangeEnd)}
          </div>
          <div className="text-xs text-muted-foreground">
            Store hours: 6:00 PM - 6:00 AM
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-3xl font-bold text-foreground">{filteredOrders.length}</div>
            <div className="text-sm text-muted-foreground">Total Orders</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-3xl font-bold text-primary">{totalPizzasSold}</div>
            <div className="text-sm text-muted-foreground">Pizzas Sold</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-500">{frontOrders.length}</div>
            <div className="text-sm text-muted-foreground">Front Orders</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-3xl font-bold text-amber-500">{takeawayOrders.length}</div>
            <div className="text-sm text-muted-foreground">Takeaway Orders</div>
          </div>
        </div>

        {/* Order Breakdowns */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Front Orders Breakdown */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              Front Orders Breakdown
            </h2>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : frontBreakdown.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No front orders in this period</div>
            ) : (
              <div className="space-y-2">
                {frontBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <span className="text-foreground">{item.name}</span>
                    <span className="font-bold text-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Takeaway Orders Breakdown */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              Takeaway Orders Breakdown
            </h2>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : takeawayBreakdown.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No takeaway orders in this period</div>
            ) : (
              <div className="space-y-2">
                {takeawayBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <span className="text-foreground">{item.name}</span>
                    <span className="font-bold text-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
