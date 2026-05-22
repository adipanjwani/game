"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

interface ItemStat {
  name: string
  quantity: number
}

interface Statistics {
  period: string
  startDate: string
  endDate: string
  totalOrders: number
  frontOrders: {
    total: number
    items: ItemStat[]
  }
  takeawayOrders: {
    total: number
    items: ItemStat[]
  }
}

export default function StatisticsPage() {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<"day" | "week">("day")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/statistics?period=${period}&date=${selectedDate.toISOString()}`
      )
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error("Failed to fetch statistics:", error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchStats()
  }, [period, selectedDate])

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate)
    if (period === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1))
    } else {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7))
    }
    setSelectedDate(newDate)
  }

  const formatDateRange = () => {
    if (!stats) return ""
    const start = new Date(stats.startDate)
    const end = new Date(stats.endDate)
    
    const formatDate = (d: Date) => {
      return d.toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    }
    
    const formatTime = (d: Date) => {
      return d.toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    }

    if (period === "day") {
      return `${formatDate(start)} ${formatTime(start)} - ${formatDate(end)} ${formatTime(end)}`
    } else {
      return `${formatDate(start)} - ${formatDate(end)}`
    }
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
          <Button variant="outline" size="sm" onClick={fetchStats} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </header>

        {/* Period Toggle */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-2">
              <Button
                variant={period === "day" ? "default" : "outline"}
                onClick={() => setPeriod("day")}
                size="sm"
              >
                Daily
              </Button>
              <Button
                variant={period === "week" ? "default" : "outline"}
                onClick={() => setPeriod("week")}
                size="sm"
              >
                Weekly
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday} className="gap-1">
                <Calendar className="h-4 w-4" />
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="mt-3 text-sm text-muted-foreground">
            {formatDateRange()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Store hours: 6:00 PM - 6:00 AM
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading statistics...</div>
        ) : stats ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-2xl font-bold text-foreground">{stats.totalOrders}</div>
                <div className="text-sm text-muted-foreground">Total Orders</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-500">{stats.frontOrders.total}</div>
                <div className="text-sm text-muted-foreground">Front Orders</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-2xl font-bold text-amber-500">{stats.takeawayOrders.total}</div>
                <div className="text-sm text-muted-foreground">Takeaway Orders</div>
              </div>
            </div>

            {/* Items Breakdown */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Front Orders */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  Front Orders Breakdown
                </h2>
                {stats.frontOrders.items.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    No front orders in this period
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats.frontOrders.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <span className="text-foreground">{item.name}</span>
                        <span className="font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">
                          {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Takeaway Orders */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  Takeaway Orders Breakdown
                </h2>
                {stats.takeawayOrders.items.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    No takeaway orders in this period
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats.takeawayOrders.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <span className="text-foreground">{item.name}</span>
                        <span className="font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                          {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Failed to load statistics
          </div>
        )}
      </div>
    </div>
  )
}
