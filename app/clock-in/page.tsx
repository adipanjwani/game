"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Clock, ArrowLeft, Delete, LogIn, LogOut, User, Check, Calendar } from "lucide-react"
import Link from "next/link"

interface StaffMember {
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

interface WeeklyEntry {
  date: string
  dayName: string
  hoursWorked: number
  clockIn: string
  clockOut: string
}

interface ClockOutSummary {
  shiftHours: number
  shiftClockIn: string
  shiftClockOut: string
  weeklyEntries: WeeklyEntry[]
  totalWeekHours: number
}

export default function ClockInPage() {
  const [pin, setPin] = useState("")
  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [currentEntry, setCurrentEntry] = useState<TimeClockEntry | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [clockOutSummary, setClockOutSummary] = useState<ClockOutSummary | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  const supabase = createClient()

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Handle numpad press
  const handleNumpadPress = (value: string) => {
    if (staff) return // Don't allow PIN changes when logged in
    
    if (value === "backspace") {
      setPin((prev) => prev.slice(0, -1))
    } else if (value === "clear") {
      setPin("")
    } else if (pin.length < 4) {
      setPin((prev) => prev + value)
    }
    setError(null)
  }

  // Verify PIN and get staff info
  const handleVerifyPin = async () => {
    if (pin.length < 4) {
      setError("PIN must be 4 digits")
      return
    }

    setIsLoading(true)
    setError(null)

    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .eq("pin", pin)
      .eq("is_active", true)
      .single()

    if (staffError || !staffData) {
      setError("Invalid PIN. Please try again.")
      setIsLoading(false)
      return
    }

    setStaff(staffData)

    // Check for open time clock entry
    const { data: entryData } = await supabase
      .from("time_clock")
      .select("*")
      .eq("staff_id", staffData.id)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .single()

    if (entryData) {
      setCurrentEntry(entryData)
    }

    setIsLoading(false)
  }

  // Clock In
  const handleClockIn = async () => {
    if (!staff) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const { data, error: insertError } = await supabase
      .from("time_clock")
      .insert({
        staff_id: staff.id,
        clock_in: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      setError("Failed to clock in. Please try again.")
      setIsLoading(false)
      return
    }

    setCurrentEntry(data)
    setSuccess(`Clocked in at ${new Date().toLocaleTimeString()}`)
    setIsLoading(false)
  }

  // Clock Out
  const handleClockOut = async () => {
    if (!staff || !currentEntry) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const clockOutTime = new Date()

    const { error: updateError } = await supabase
      .from("time_clock")
      .update({
        clock_out: clockOutTime.toISOString(),
      })
      .eq("id", currentEntry.id)

    if (updateError) {
      setError("Failed to clock out. Please try again.")
      setIsLoading(false)
      return
    }

    const clockInTime = new Date(currentEntry.clock_in)
    const shiftHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)

    // Get current week's entries (Monday to Sunday)
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    const { data: weekEntries } = await supabase
      .from("time_clock")
      .select("*")
      .eq("staff_id", staff.id)
      .not("clock_out", "is", null)
      .gte("clock_in", monday.toISOString())
      .lte("clock_in", sunday.toISOString())
      .order("clock_in", { ascending: true })

    const weeklyEntries: WeeklyEntry[] = (weekEntries || []).map((entry) => {
      const entryClockIn = new Date(entry.clock_in)
      const entryClockOut = new Date(entry.clock_out)
      const hours = (entryClockOut.getTime() - entryClockIn.getTime()) / (1000 * 60 * 60)
      
      return {
        date: entryClockIn.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        dayName: entryClockIn.toLocaleDateString("en-US", { weekday: "long" }),
        hoursWorked: hours,
        clockIn: entryClockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        clockOut: entryClockOut.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
    })

    const totalWeekHours = weeklyEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0)

    setClockOutSummary({
      shiftHours,
      shiftClockIn: clockInTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      shiftClockOut: clockOutTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      weeklyEntries,
      totalWeekHours,
    })

    setCurrentEntry(null)
    setIsLoading(false)
  }

  // Reset / Logout
  const handleReset = () => {
    setPin("")
    setStaff(null)
    setCurrentEntry(null)
    setError(null)
    setSuccess(null)
    setClockOutSummary(null)
  }

  // Calculate time worked so far
  const getTimeWorked = () => {
    if (!currentEntry) return null
    const clockInTime = new Date(currentEntry.clock_in)
    const elapsed = currentTime.getTime() - clockInTime.getTime()
    const hours = Math.floor(elapsed / (1000 * 60 * 60))
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000)
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Staff Clock In</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-lg md:text-xl font-mono font-bold text-muted-foreground">
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          {!staff ? (
            // PIN Entry Screen
            <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
              <div className="text-center mb-6">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <h2 className="text-lg font-semibold text-foreground">Enter Your PIN</h2>
                <p className="text-sm text-muted-foreground">Enter your staff PIN to clock in or out</p>
              </div>

              {/* PIN Display */}
              <div className="flex justify-center gap-2 mb-6">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-12 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${
                      pin[i] ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted/30"
                    }`}
                  >
                    {pin[i] ? "•" : ""}
                  </div>
                ))}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"].map((key) => (
                  <Button
                    key={key}
                    variant={key === "clear" ? "secondary" : key === "backspace" ? "outline" : "outline"}
                    className={`h-14 text-xl font-bold ${key === "clear" || key === "backspace" ? "text-sm" : ""}`}
                    onClick={() => handleNumpadPress(key)}
                  >
                    {key === "backspace" ? <Delete className="h-5 w-5" /> : key === "clear" ? "CLR" : key}
                  </Button>
                ))}
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-center text-sm text-red-500 mb-4">{error}</div>
              )}

              {/* Submit Button */}
              <Button
                className="w-full h-12 text-lg font-bold"
                onClick={handleVerifyPin}
                disabled={pin.length < 4 || isLoading}
              >
                {isLoading ? "Verifying..." : "Submit"}
              </Button>
            </div>
          ) : clockOutSummary ? (
            // Clock Out Summary Screen
            <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Clocked Out Successfully</h2>
                <p className="text-sm text-muted-foreground">{staff.name}</p>
              </div>

              {/* Current Shift Summary */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  This Shift
                </h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Time</span>
                  <span className="font-mono text-foreground">
                    {clockOutSummary.shiftClockIn} - {clockOutSummary.shiftClockOut}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Hours Worked</span>
                  <span className="font-mono font-bold text-primary text-lg">
                    {clockOutSummary.shiftHours.toFixed(2)} hrs
                  </span>
                </div>
              </div>

              {/* Weekly Summary */}
              <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  This Week
                </h3>
                
                {clockOutSummary.weeklyEntries.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {clockOutSummary.weeklyEntries.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{entry.dayName}</span>
                          <span className="text-xs text-muted-foreground">{entry.date}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-sm text-foreground">{entry.hoursWorked.toFixed(2)} hrs</span>
                          <span className="text-xs text-muted-foreground">{entry.clockIn} - {entry.clockOut}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-3">No completed shifts this week</p>
                )}
                
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm font-semibold text-foreground">Total Week Hours</span>
                  <span className="font-mono font-bold text-foreground text-lg">
                    {clockOutSummary.totalWeekHours.toFixed(2)} hrs
                  </span>
                </div>
              </div>

              {/* Done Button */}
              <Button
                className="w-full h-12 text-lg font-bold"
                onClick={handleReset}
              >
                Done
              </Button>
            </div>
          ) : (
            // Clock In/Out Screen
            <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">{staff.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {currentEntry ? "Currently clocked in" : "Not clocked in"}
                </p>
              </div>

              {/* Current Status */}
              {currentEntry && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Clocked in at</span>
                    <span className="font-mono font-bold text-foreground">
                      {new Date(currentEntry.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Time worked</span>
                    <span className="font-mono font-bold text-green-600 text-lg">{getTimeWorked()}</span>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-600">{success}</span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="text-center text-sm text-red-500 mb-4">{error}</div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {currentEntry ? (
                  <Button
                    className="w-full h-14 text-lg font-bold bg-red-600 hover:bg-red-700"
                    onClick={handleClockOut}
                    disabled={isLoading}
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    {isLoading ? "Processing..." : "Clock Out"}
                  </Button>
                ) : (
                  <Button
                    className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700"
                    onClick={handleClockIn}
                    disabled={isLoading}
                  >
                    <LogIn className="h-5 w-5 mr-2" />
                    {isLoading ? "Processing..." : "Clock In"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full h-12"
                  onClick={handleReset}
                >
                  Switch User
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
