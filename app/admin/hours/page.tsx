"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
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
import { Home, ChefHat, ArrowLeft, Clock, ChevronLeft, ChevronRight, Users, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

interface Staff {
  id: string
  name: string
  is_active: boolean
}

interface TimeClockEntry {
  id: string
  staff_id: string
  clock_in: string
  clock_out: string | null
}

interface StaffHours {
  staff: Staff
  totalHours: number
  totalShifts: number
  avgHoursPerShift: number
  lastClockIn: Date | null
}

type SortField = "name" | "hours" | "shifts" | "avg" | "clockin"
type SortDirection = "asc" | "desc"
type DateRange = "week" | "month" | "year" | "all"

export default function StaffHoursPage() {
  const supabase = createClient()
  const [staffHours, setStaffHours] = useState<StaffHours[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>("week")
  const [sortField, setSortField] = useState<SortField>("hours")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  const getDateRangeFilter = () => {
    const now = new Date()
    let startDate: Date
    let endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    if (dateRange === "week") {
      startDate = new Date(weekStart)
      endDate = new Date(weekStart)
      endDate.setDate(endDate.getDate() + 6)
      endDate.setHours(23, 59, 59, 999)
    } else if (dateRange === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      endDate.setHours(23, 59, 59, 999)
    } else if (dateRange === "year") {
      startDate = new Date(now.getFullYear(), 0, 1)
      endDate = new Date(now.getFullYear(), 11, 31)
      endDate.setHours(23, 59, 59, 999)
    } else {
      return { startDate: null, endDate: null }
    }

    return { startDate, endDate }
  }

  const fetchStaffHours = async () => {
    setIsLoading(true)

    // Fetch all staff
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .order("name")

    if (staffError || !staffData) {
      console.error("Failed to fetch staff:", staffError)
      setIsLoading(false)
      return
    }

    const { startDate, endDate } = getDateRangeFilter()

    // Fetch time entries
    let query = supabase
      .from("time_clock")
      .select("*")
      .not("clock_out", "is", null)

    if (startDate && endDate) {
      query = query
        .gte("clock_in", startDate.toISOString())
        .lte("clock_in", endDate.toISOString())
    }

    const { data: entriesData, error: entriesError } = await query

    if (entriesError) {
      console.error("Failed to fetch entries:", entriesError)
      setIsLoading(false)
      return
    }

    // Calculate hours per staff
    const hoursMap = new Map<string, { totalHours: number; shifts: number; lastClockIn: Date | null }>()

    staffData.forEach((staff) => {
      hoursMap.set(staff.id, { totalHours: 0, shifts: 0, lastClockIn: null })
    })

    ;(entriesData || []).forEach((entry) => {
      const clockIn = new Date(entry.clock_in)
      const clockOut = new Date(entry.clock_out)
      const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)

      const existing = hoursMap.get(entry.staff_id)
      if (existing) {
        existing.totalHours += hours
        existing.shifts += 1
        if (!existing.lastClockIn || clockIn > existing.lastClockIn) {
          existing.lastClockIn = clockIn
        }
      }
    })

    const result: StaffHours[] = staffData.map((staff) => {
      const data = hoursMap.get(staff.id) || { totalHours: 0, shifts: 0, lastClockIn: null }
      return {
        staff,
        totalHours: data.totalHours,
        totalShifts: data.shifts,
        avgHoursPerShift: data.shifts > 0 ? data.totalHours / data.shifts : 0,
        lastClockIn: data.lastClockIn,
      }
    })

    setStaffHours(result)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchStaffHours()
  }, [dateRange, weekStart])

  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(newStart.getDate() - 7)
    setWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(newStart.getDate() + 7)
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

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const weekRangeDisplay = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection(field === "name" ? "asc" : "desc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground" />
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1 text-primary" />
    }
    return <ArrowDown className="h-4 w-4 ml-1 text-primary" />
  }

  const sortedStaffHours = [...staffHours].sort((a, b) => {
    let comparison = 0

    if (sortField === "name") {
      comparison = a.staff.name.localeCompare(b.staff.name)
    } else if (sortField === "hours") {
      comparison = a.totalHours - b.totalHours
    } else if (sortField === "shifts") {
      comparison = a.totalShifts - b.totalShifts
    } else if (sortField === "avg") {
      comparison = a.avgHoursPerShift - b.avgHoursPerShift
    } else if (sortField === "clockin") {
      const timeA = a.lastClockIn ? a.lastClockIn.getTime() : 0
      const timeB = b.lastClockIn ? b.lastClockIn.getTime() : 0
      comparison = timeA - timeB
    }

    return sortDirection === "asc" ? comparison : -comparison
  })

  const totalAllHours = staffHours.reduce((sum, s) => sum + s.totalHours, 0)
  const totalAllShifts = staffHours.reduce((sum, s) => sum + s.totalShifts, 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/staff">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">Staff Hours Summary</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/timesheet">
              <Button variant="outline" size="sm" className="gap-1">
                <Clock className="h-4 w-4" />
                Timesheet
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-1">
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <Link href="/kitchen">
              <Button variant="outline" size="sm" className="gap-1">
                <ChefHat className="h-4 w-4" />
                Kitchen
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Period:</span>
            <Select value={dateRange} onValueChange={(val) => setDateRange(val as DateRange)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Week Navigation (only show for week view) */}
          {dateRange === "week" && (
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
          )}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading staff hours...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="min-w-[150px] cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Staff Name
                      {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[80px] text-center">Status</TableHead>
                  <TableHead
                    className="min-w-[140px] text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("clockin")}
                  >
                    <div className="flex items-center justify-end">
                      Last Clock In
                      {getSortIcon("clockin")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="min-w-[100px] text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("shifts")}
                  >
                    <div className="flex items-center justify-end">
                      Shifts
                      {getSortIcon("shifts")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="min-w-[120px] text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("hours")}
                  >
                    <div className="flex items-center justify-end">
                      Total Hours
                      {getSortIcon("hours")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="min-w-[120px] text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("avg")}
                  >
                    <div className="flex items-center justify-end">
                      Avg/Shift
                      {getSortIcon("avg")}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStaffHours.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No staff found
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {sortedStaffHours.map((item) => (
                      <TableRow key={item.staff.id}>
                        <TableCell className="font-medium">{item.staff.name}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.staff.is_active
                                ? "bg-green-500/20 text-green-600"
                                : "bg-red-500/20 text-red-600"
                            }`}
                          >
                            {item.staff.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {item.lastClockIn ? (
                            <div className="flex flex-col items-end">
                              <span>{item.lastClockIn.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                              <span className="text-muted-foreground text-xs">{item.lastClockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{item.totalShifts}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {item.totalHours.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {item.avgHoursPerShift.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono">{totalAllShifts}</TableCell>
                      <TableCell className="text-right font-mono">{totalAllHours.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {totalAllShifts > 0 ? (totalAllHours / totalAllShifts).toFixed(2) : "0.00"}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  )
}
