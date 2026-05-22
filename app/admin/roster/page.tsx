"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, RefreshCw } from "lucide-react"

const MASTER_PIN = "8988"

interface Staff {
  id: string
  name: string
  is_active: boolean
}

interface TimeClockRecord {
  id: string
  staff_id: string
  clock_in: string
  clock_out: string | null
}

interface StaffWeekData {
  staff: Staff
  days: {
    date: string
    records: TimeClockRecord[]
    totalMinutes: number
  }[]
  weekTotalMinutes: number
}

export default function RosterPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState("")
  const [weekData, setWeekData] = useState<StaffWeekData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
    return new Date(now.setDate(diff))
  })

  const handlePinSubmit = () => {
    if (pin === MASTER_PIN) {
      setIsAuthenticated(true)
      setPinError("")
    } else {
      setPinError("Invalid PIN")
      setPin("")
    }
  }

  const fetchRosterData = async () => {
    setIsLoading(true)
    try {
      const endDate = new Date(weekStart)
      endDate.setDate(endDate.getDate() + 6)
      
      const res = await fetch(
        `/api/roster?startDate=${weekStart.toISOString()}&endDate=${endDate.toISOString()}`
      )
      const data = await res.json()
      setWeekData(data)
    } catch (error) {
      console.error("Failed to fetch roster data:", error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchRosterData()
    }
  }, [isAuthenticated, weekStart])

  const navigateWeek = (direction: "prev" | "next") => {
    setWeekStart(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + (direction === "prev" ? -7 : 7))
      return newDate
    })
  }

  const goToCurrentWeek = () => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    setWeekStart(new Date(now.setDate(diff)))
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getWeekDays = () => {
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)
      days.push(date)
    }
    return days
  }

  const weekDays = getWeekDays()

  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">Super Admin Access</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Enter the master PIN to access the roster.
          </p>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
              className="text-center text-lg tracking-widest"
            />
            {pinError && (
              <p className="text-sm text-destructive text-center">{pinError}</p>
            )}
            <Button onClick={handlePinSubmit} className="w-full" disabled={pin.length !== 4}>
              Access Roster
            </Button>
            <Link href="/admin">
              <Button variant="ghost" className="w-full gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Staff Roster</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
              This Week
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={fetchRosterData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Week Range */}
        <div className="text-center mb-6">
          <p className="text-lg font-medium text-foreground">
            {weekStart.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} - {" "}
            {weekDays[6].toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Roster Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading roster data...</div>
          ) : weekData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No staff members found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-semibold text-foreground min-w-[120px]">Staff</th>
                    {weekDays.map((day, i) => (
                      <th key={i} className="text-center p-3 font-semibold text-foreground min-w-[100px]">
                        <div>{day.toLocaleDateString("en-AU", { weekday: "short" })}</div>
                        <div className="text-xs text-muted-foreground">
                          {day.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </div>
                      </th>
                    ))}
                    <th className="text-center p-3 font-semibold text-foreground min-w-[90px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {weekData.map((staffData) => (
                    <tr key={staffData.staff.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium text-foreground">{staffData.staff.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {staffData.staff.is_active ? "Active" : "Inactive"}
                        </div>
                      </td>
                      {staffData.days.map((dayData, i) => (
                        <td key={i} className="p-2 text-center">
                          {dayData.records.length > 0 ? (
                            <div className="space-y-1">
                              {dayData.records.map((record, j) => (
                                <div key={j} className="text-xs bg-green-500/10 rounded p-1">
                                  <div className="text-green-600 dark:text-green-400">
                                    {formatTime(record.clock_in)}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {record.clock_out ? formatTime(record.clock_out) : "Active"}
                                  </div>
                                </div>
                              ))}
                              <div className="text-xs font-medium text-foreground">
                                {formatMinutes(dayData.totalMinutes)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                      ))}
                      <td className="p-3 text-center">
                        <div className="font-bold text-foreground">
                          {formatMinutes(staffData.weekTotalMinutes)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
