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

type SortField = "staff" | "date" | "day" | null
type SortDirection = "asc" | "desc"

export default function TimesheetPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
  const [entries, setEntries] = useState<TimeClockEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
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

  const getStaffTotals = (): { name: string; hours: number }[] => {
    const totals = new Map<string, number>()
    displayedEntries.forEach((entry) => {
      const name = entry.staff?.name || "Unknown"
      const hours = calculateHours(entry.clock_in, entry.clock_out)
      totals.set(name, (totals.get(name) || 0) + hours)
    })
    return Array.from(totals.entries())
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const staffTotals = getStaffTotals()

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
        <div className="flex flex-col gap-4 mb-6">
          {/* Week Navigation and Staff Filter Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

          {/* Search Row */}
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

        {/* Per-Staff Total Hours Summary */}
        {!isLoading && staffTotals.length > 0 && (
          <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Total Hours per Staff</h2>
              {searchQuery && <span className="text-sm text-muted-foreground font-normal">(filtered)</span>}
            </div>
            <div className="divide-y divide-border">
              {staffTotals.map((member) => (
                <div key={member.name} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium text-foreground">{member.name}</span>
                  <span className="font-mono font-medium text-foreground">{member.hours.toFixed(2)} hrs</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
                <span className="font-semibold text-foreground">Grand Total</span>
                <span className="font-mono font-semibold text-foreground">{getFilteredTotalHours().toFixed(2)} hrs</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
