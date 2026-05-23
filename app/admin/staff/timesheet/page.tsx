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
import { Home, ChefHat, ArrowLeft, Clock, ChevronLeft, ChevronRight, Users, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Staff {
  id: string
  name: string
  is_active?: boolean
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

interface StaffHours {
  staff: Staff
  totalHours: number
  totalShifts: number
  avgHoursPerShift: number
  lastClockIn: Date | null
}

type SortField = "staff" | "date" | "day" | null
type SummarySortField = "name" | "hours" | "shifts" | "avg" | "clockin"
type SortDirection = "asc" | "desc"

export default function TimesheetPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
  const [entries, setEntries] = useState<TimeClockEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [activeTab, setActiveTab] = useState<string>("timesheet")
  
  // Staff Hours Summary state
  const [staffHours, setStaffHours] = useState<StaffHours[]>([])
  const [summarySortField, setSummarySortField] = useState<SummarySortField>("hours")
  const [summarySortDirection, setSummarySortDirection] = useState<SortDirection>("desc")
  
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
      .select("id, name, is_active")
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

  const calculateStaffHours = () => {
    const hoursMap = new Map<string, { totalHours: number; shifts: number; lastClockIn: Date | null }>()

    staff.forEach((s) => {
      hoursMap.set(s.id, { totalHours: 0, shifts: 0, lastClockIn: null })
    })

    entries.forEach((entry) => {
      if (!entry.clock_out) return
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

    const result: StaffHours[] = staff.map((s) => {
      const data = hoursMap.get(s.id) || { totalHours: 0, shifts: 0, lastClockIn: null }
      return {
        staff: s,
        totalHours: data.totalHours,
        totalShifts: data.shifts,
        avgHoursPerShift: data.shifts > 0 ? data.totalHours / data.shifts : 0,
        lastClockIn: data.lastClockIn,
      }
    })

    setStaffHours(result)
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [weekStart, selectedStaffId])

  useEffect(() => {
    if (entries.length >= 0 && staff.length > 0) {
      calculateStaffHours()
    }
  }, [entries, staff])

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else {
        setSortField(null)
        setSortDirection("asc")
      }
    } else {
      setSortField(field)
      setSortDirection("asc")
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

  const filteredAndSortedEntries = () => {
    let filtered = [...entries]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((entry) => {
        const staffName = entry.staff?.name?.toLowerCase() || ""
        const clockInDate = new Date(entry.clock_in)
        const dayName = clockInDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
        const dayShort = clockInDate.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase()
        const dateFormatted = clockInDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase()
        const dateNumeric = clockInDate.toLocaleDateString().toLowerCase()

        return (
          staffName.includes(query) ||
          dayName.includes(query) ||
          dayShort.includes(query) ||
          dateFormatted.includes(query) ||
          dateNumeric.includes(query)
        )
      })
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let comparison = 0

        if (sortField === "staff") {
          const nameA = a.staff?.name || ""
          const nameB = b.staff?.name || ""
          comparison = nameA.localeCompare(nameB)
        } else if (sortField === "date") {
          comparison = new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
        } else if (sortField === "day") {
          const dayA = new Date(a.clock_in).getDay()
          const dayB = new Date(b.clock_in).getDay()
          // Adjust so Monday = 0, Sunday = 6
          const adjustedDayA = dayA === 0 ? 6 : dayA - 1
          const adjustedDayB = dayB === 0 ? 6 : dayB - 1
          comparison = adjustedDayA - adjustedDayB
        }

        return sortDirection === "asc" ? comparison : -comparison
      })
    }

    return filtered
  }

  const displayedEntries = filteredAndSortedEntries()

  const getFilteredTotalHours = (): number => {
    return displayedEntries.reduce((total, entry) => {
      return total + calculateHours(entry.clock_in, entry.clock_out)
    }, 0)
  }

  // Staff Hours Summary sorting
  const handleSummarySort = (field: SummarySortField) => {
    if (summarySortField === field) {
      setSummarySortDirection(summarySortDirection === "asc" ? "desc" : "asc")
    } else {
      setSummarySortField(field)
      setSummarySortDirection(field === "name" ? "asc" : "desc")
    }
  }

  const getSummarySortIcon = (field: SummarySortField) => {
    if (summarySortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground" />
    }
    if (summarySortDirection === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1 text-primary" />
    }
    return <ArrowDown className="h-4 w-4 ml-1 text-primary" />
  }

  const sortedStaffHours = [...staffHours].sort((a, b) => {
    let comparison = 0

    if (summarySortField === "name") {
      comparison = a.staff.name.localeCompare(b.staff.name)
    } else if (summarySortField === "hours") {
      comparison = a.totalHours - b.totalHours
    } else if (summarySortField === "shifts") {
      comparison = a.totalShifts - b.totalShifts
    } else if (summarySortField === "avg") {
      comparison = a.avgHoursPerShift - b.avgHoursPerShift
    } else if (summarySortField === "clockin") {
      const timeA = a.lastClockIn ? a.lastClockIn.getTime() : 0
      const timeB = b.lastClockIn ? b.lastClockIn.getTime() : 0
      comparison = timeA - timeB
    }

    return summarySortDirection === "asc" ? comparison : -comparison
  })

  const totalAllHours = staffHours.reduce((sum, s) => sum + s.totalHours, 0)
  const totalAllShifts = staffHours.reduce((sum, s) => sum + s.totalShifts, 0)

  const weekRangeDisplay = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/staff">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Timesheet</h1>
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

        {/* Week Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
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
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
            <TabsTrigger value="summary">Staff Hours</TabsTrigger>
          </TabsList>

          {/* Timesheet Tab */}
          <TabsContent value="timesheet">
            {/* Controls */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Staff Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Filter by:</span>
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {staff.filter(s => s.is_active).map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Search */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by staff name, day, or date..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {searchQuery && (
                    <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
                      Clear
                    </Button>
                  )}
                </div>
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
                        <TableHead 
                          className="min-w-[120px] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("staff")}
                        >
                          <div className="flex items-center">
                            Staff
                            {getSortIcon("staff")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="min-w-[100px] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("date")}
                        >
                          <div className="flex items-center">
                            Date
                            {getSortIcon("date")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="min-w-[80px] cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("day")}
                        >
                          <div className="flex items-center">
                            Day
                            {getSortIcon("day")}
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[90px]">Clock In</TableHead>
                        <TableHead className="min-w-[90px]">Clock Out</TableHead>
                        <TableHead className="min-w-[80px] text-right">Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {searchQuery ? "No matching entries found" : "No time entries for this week"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {displayedEntries.map((entry) => {
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
                            <TableCell colSpan={5}>
                              Total Hours {searchQuery && <span className="text-muted-foreground font-normal">(filtered)</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono">{getFilteredTotalHours().toFixed(2)}</TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Staff Hours Summary Tab */}
          <TabsContent value="summary">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading staff hours...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="min-w-[150px] cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSummarySort("name")}
                      >
                        <div className="flex items-center">
                          Staff Name
                          {getSummarySortIcon("name")}
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[80px] text-center">Status</TableHead>
                      <TableHead
                        className="min-w-[140px] text-right cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSummarySort("clockin")}
                      >
                        <div className="flex items-center justify-end">
                          Last Clock In
                          {getSummarySortIcon("clockin")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="min-w-[100px] text-right cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSummarySort("shifts")}
                      >
                        <div className="flex items-center justify-end">
                          Shifts
                          {getSummarySortIcon("shifts")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="min-w-[120px] text-right cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSummarySort("hours")}
                      >
                        <div className="flex items-center justify-end">
                          Total Hours
                          {getSummarySortIcon("hours")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="min-w-[120px] text-right cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSummarySort("avg")}
                      >
                        <div className="flex items-center justify-end">
                          Avg/Shift
                          {getSummarySortIcon("avg")}
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
