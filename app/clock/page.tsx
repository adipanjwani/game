"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock, LogIn, LogOut, ArrowLeft, Check, X } from "lucide-react"
import Link from "next/link"
import {
  startOfWeek,
  endOfWeek,
  differenceInMinutes,
  format,
} from "date-fns"

interface Staff {
  id: string
  name: string
  pin: string
  is_active: boolean
}

interface TimeEntry {
  id: string
  staff_id: string
  clock_in: string
  clock_out: string | null
}

type ClockStatus = "idle" | "success" | "error"

export default function ClockPage() {
  const [pin, setPin] = useState("")
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [weeklyHours, setWeeklyHours] = useState<number | null>(null)
  const [staffName, setStaffName] = useState<string | null>(null)
  const [clockStatus, setClockStatus] = useState<ClockStatus>("idle")
  const [isClockedIn, setIsClockedIn] = useState(false)
  const supabase = createClient()

  // Initialize and update clock every second (client-side only to avoid hydration mismatch)
  useEffect(() => {
    setCurrentTime(new Date())
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-hide message after 5 seconds
  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => {
        setMessage(null)
        setWeeklyHours(null)
        setStaffName(null)
        setClockStatus("idle")
        setIsClockedIn(false)
      }, 5000)
      return () => clearTimeout(timeout)
    }
  }, [message])

  const calculateWeeklyHours = useCallback(async (staffId: string): Promise<number> => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }) // Sunday

    const { data: entries } = await supabase
      .from("time_clock")
      .select("*")
      .eq("staff_id", staffId)
      .gte("clock_in", weekStart.toISOString())
      .lte("clock_in", weekEnd.toISOString())

    if (!entries) return 0

    let totalMinutes = 0
    for (const entry of entries) {
      const clockIn = new Date(entry.clock_in)
      const clockOut = entry.clock_out ? new Date(entry.clock_out) : new Date()
      totalMinutes += differenceInMinutes(clockOut, clockIn)
    }

    return totalMinutes / 60
  }, [supabase])

  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      setMessage({ text: "Please enter a 4-digit PIN", type: "error" })
      setClockStatus("error")
      return
    }

    setIsProcessing(true)
    setMessage(null)

    try {
      // Find staff by PIN
      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .eq("pin", pin)
        .eq("is_active", true)
        .single()

      if (staffError || !staff) {
        setMessage({ text: "Invalid PIN. Please try again.", type: "error" })
        setClockStatus("error")
        setPin("")
        setIsProcessing(false)
        return
      }

      setStaffName(staff.name)

      // Check if currently clocked in (has entry without clock_out)
      const { data: openEntry } = await supabase
        .from("time_clock")
        .select("*")
        .eq("staff_id", staff.id)
        .is("clock_out", null)
        .single()

      if (openEntry) {
        // Clock out
        const { error: clockOutError } = await supabase
          .from("time_clock")
          .update({ clock_out: new Date().toISOString() })
          .eq("id", openEntry.id)

        if (clockOutError) throw clockOutError

        const hours = await calculateWeeklyHours(staff.id)
        setWeeklyHours(hours)
        setIsClockedIn(false)
        setMessage({ text: `Goodbye ${staff.name}! You have clocked out.`, type: "success" })
        setClockStatus("success")
      } else {
        // Clock in
        const { error: clockInError } = await supabase
          .from("time_clock")
          .insert({
            staff_id: staff.id,
            clock_in: new Date().toISOString(),
          })

        if (clockInError) throw clockInError

        const hours = await calculateWeeklyHours(staff.id)
        setWeeklyHours(hours)
        setIsClockedIn(true)
        setMessage({ text: `Welcome ${staff.name}! You have clocked in.`, type: "success" })
        setClockStatus("success")
      }

      setPin("")
    } catch (error) {
      console.error("Clock operation failed:", error)
      setMessage({ text: "An error occurred. Please try again.", type: "error" })
      setClockStatus("error")
    }

    setIsProcessing(false)
  }

  const handleKeyPress = (key: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + key)
    }
  }

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1))
  }

  const handleClear = () => {
    setPin("")
    setMessage(null)
    setClockStatus("idle")
  }

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Staff Clock</h1>
          <div className="w-20" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8">
          {/* Current Time Display */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-5 w-5" />
              <span className="text-sm">{currentTime ? format(currentTime, "EEEE, MMMM d, yyyy") : "\u00A0"}</span>
            </div>
            <div className="text-6xl font-mono font-bold text-foreground tracking-tight">
              {currentTime ? format(currentTime, "HH:mm:ss") : "--:--:--"}
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`p-4 rounded-lg text-center space-y-3 ${
                message.type === "success"
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {message.type === "success" ? (
                  isClockedIn ? (
                    <LogIn className="h-5 w-5 text-green-500" />
                  ) : (
                    <LogOut className="h-5 w-5 text-green-500" />
                  )
                ) : (
                  <X className="h-5 w-5 text-red-500" />
                )}
                <span
                  className={`font-medium ${
                    message.type === "success" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {message.text}
                </span>
              </div>
              {weeklyHours !== null && (
                <div className="text-sm text-muted-foreground">
                  Weekly hours (Mon-Sun): <span className="font-semibold text-foreground">{formatHours(weeklyHours)}</span>
                </div>
              )}
            </div>
          )}

          {/* PIN Display */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground text-center block">
              Enter your 4-digit PIN
            </label>
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                    pin[i]
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {pin[i] ? "●" : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                variant="outline"
                size="lg"
                className="h-16 text-2xl font-semibold"
                onClick={() => handleKeyPress(num.toString())}
                disabled={isProcessing}
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              size="lg"
              className="h-16 text-sm font-medium text-muted-foreground"
              onClick={handleClear}
              disabled={isProcessing}
            >
              Clear
            </Button>
            <Button
              key={0}
              variant="outline"
              size="lg"
              className="h-16 text-2xl font-semibold"
              onClick={() => handleKeyPress("0")}
              disabled={isProcessing}
            >
              0
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-16"
              onClick={handleBackspace}
              disabled={isProcessing}
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </div>

          {/* Submit Button */}
          <Button
            size="lg"
            className="w-full h-14 text-lg font-semibold gap-2"
            onClick={handlePinSubmit}
            disabled={pin.length !== 4 || isProcessing}
          >
            {isProcessing ? (
              "Processing..."
            ) : (
              <>
                <Check className="h-5 w-5" />
                Clock In / Out
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}
