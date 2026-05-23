"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Home, ChefHat, ArrowLeft, Clock, ChevronLeft, ChevronRight, Users } from "lucide-react"

interface Staff {
  id: string
  name: string
}

interface TimeClockEntry {
  id: string
  staff_id: string
  clock_in: string
  clock_out: string | null
  staff: {
    name: string
  }
}

interface WeekDay {
  date: Date
  dayName: string
  dayShort: string
  dateFormatted: string
}

export default function TimesheetPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
  const [entries, setEntries] = useState<TimeClockEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  const supabase = createClient()

  const getWeekDays = (): WeekDay[] => {
    const days: WeekDay[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      days.push({
        date,
        dayName: date.toLocaleDateString("en-US", { weekday: "long" }),
        dayShort: date.toLocaleDateString("en-US", { weekday: "short" }),
        dateFormatted: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      })
    }
    return days
  }

  const weekDays = getWeekDays()
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true })

    setStaff(data || [])
  }

  const fetchEntries = async () => {
    setIsLoading(true)
    
    let query = supabase
      .from("time_clock")
      .select("*, staff(name)")
      .gte("clock_in", weekStart.toISOString())
      .lte("clock_in", weekEnd.toISOString())
      .order("clock_in", { ascending: true })

    if (selectedStaffId !== "all") {
      query = query.eq("staff_id", selectedStaffId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Failed to fetch entries:", error)
    } else {
      setEntries(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [weekStart, selectedStaffId])

  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(weekStart.getDate() - 7)
    setWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(weekStart.getDate() + 7)
    setWeekStart(newStart)
  }

  const goToCurrentWeek = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    setWeekStart(monday)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const calculateHours = (clockIn: string, clockOut: string | null): number => {
    if (!clockOut) return 0
    const start = new Date(clockIn)
    const end = new Date(clockOut)
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  }

  const formatHours = (hours: number): string => {
    if (hours === 0) return "-"
    return hours.toFixed(2)
  }

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    )
  }

  const getEntriesForDay = (day: Date): TimeClockEntry[] => {
    return entries.filter((entry) => {
      const entryDate = new Date(entry.clock_in)
      return isSameDay(entryDate, day)
    })
  }

  const getTotalWeekHours = (): number => {
    return entries.reduce((total, entry) => {
      return total + calculateHours(entry.clock_in, entry.clock_out)
    }, 0)
  }

  const weekRangeDisplay = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Weekly Timesheet</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/staff">
              <Button variant="outline" size="sm" className="gap-1">
                <Users className="h-4 w-4" />
                Staff
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-1">
                <Home className="h-4 w-4" />
                Front
              </Button>
            </Link>
            <Link href="/kitchen">
              <Button variant="outline" size="sm" className="gap-1">
                <ChefHat className="h-4 w-4" />
                Kitchen
              </Button>
            </Link>
          </div>
        </header>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-4 py-2 bg-card border border-border rounded-lg min-w-[200px] text-center">
              <span className="font-medium text-foreground">{weekRangeDisplay}</span>
            </div>
            <Button variant="outline" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={goToCurrentWeek}>
              Today
            </Button>
          </div>

          {/* Staff Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter by:</span>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Timesheet Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading timesheet...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Staff</TableHead>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="min-w-[80px]">Day</TableHead>
                    <TableHead className="min-w-[90px]">Clock In</TableHead>
                    <TableHead className="min-w-[90px]">Clock Out</TableHead>
                    <TableHead className="min-w-[80px] text-right">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No time entries for this week
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {entries.map((entry) => {
                        const clockInDate = new Date(entry.clock_in)
                        const hours = calculateHours(entry.clock_in, entry.clock_out)
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">{entry.staff?.name || "Unknown"}</TableCell>
                            <TableCell>{clockInDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</TableCell>
                            <TableCell>{clockInDate.toLocaleDateString("en-US", { weekday: "short" })}</TableCell>
                            <TableCell className="font-mono">{formatTime(entry.clock_in)}</TableCell>
                            <TableCell className="font-mono">
                              {entry.clock_out ? (
                                formatTime(entry.clock_out)
                              ) : (
                                <span className="text-green-600 font-medium">Active</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {entry.clock_out ? `${hours.toFixed(2)}` : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {/* Total Row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={5}>Total Hours</TableCell>
                        <TableCell className="text-right font-mono">{getTotalWeekHours().toFixed(2)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
