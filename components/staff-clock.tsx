"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Clock, Delete, LogIn, LogOut } from "lucide-react"

interface Staff {
  id: string
  name: string
}

interface ActiveShift {
  id: string
  clock_in: string
}

export function StaffClock() {
  const [isOpen, setIsOpen] = useState(false)
  const [pin, setPin] = useState("")
  const [staff, setStaff] = useState<Staff | null>(null)
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null)
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<"pin" | "action">("pin")

  const resetState = () => {
    setPin("")
    setStaff(null)
    setIsClockedIn(false)
    setActiveShift(null)
    setMessage("")
    setStep("pin")
  }

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit)
    }
  }

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1))
  }

  const handleClear = () => {
    setPin("")
    setMessage("")
  }

  const verifyPin = async () => {
    if (pin.length !== 4) {
      setMessage("PIN must be exactly 4 digits")
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      const res = await fetch("/api/time-clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || "Invalid PIN")
        setPin("")
      } else {
        setStaff(data.staff)
        setIsClockedIn(data.isClockedIn)
        setActiveShift(data.activeShift)
        setStep("action")
      }
    } catch {
      setMessage("Something went wrong")
    }

    setIsLoading(false)
  }

  const handleClockAction = async (action: "clock_in" | "clock_out") => {
    setIsLoading(true)
    setMessage("")

    try {
      const res = await fetch("/api/time-clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, action }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || "Action failed")
      } else {
        setMessage(data.message)
        setTimeout(() => {
          setIsOpen(false)
          resetState()
        }, 1500)
      }
    } catch {
      setMessage("Something went wrong")
    }

    setIsLoading(false)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetState()
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-xs md:text-sm h-7 md:h-8">
          <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
          Clock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === "pin" ? "Enter Your PIN" : `Welcome, ${staff?.name}`}
          </DialogTitle>
        </DialogHeader>

        {step === "pin" ? (
          <div className="flex flex-col items-center gap-4">
            {/* PIN Display */}
            <div className="flex gap-2 my-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={`w-10 h-12 border-2 rounded-lg flex items-center justify-center text-xl font-bold ${
                    i < pin.length ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  {i < pin.length ? "•" : ""}
                </div>
              ))}
            </div>

            {/* Message */}
            {message && (
              <p className="text-sm text-destructive text-center">{message}</p>
            )}

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-14 text-xl font-semibold"
                  onClick={() => handlePinInput(num.toString())}
                >
                  {num}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-14"
                onClick={handleClear}
              >
                Clear
              </Button>
              <Button
                variant="outline"
                className="h-14 text-xl font-semibold"
                onClick={() => handlePinInput("0")}
              >
                0
              </Button>
              <Button
                variant="outline"
                className="h-14"
                onClick={handleBackspace}
              >
                <Delete className="h-5 w-5" />
              </Button>
            </div>

            {/* Submit */}
            <Button 
              className="w-full max-w-[240px] mt-2" 
              onClick={verifyPin}
              disabled={pin.length !== 4 || isLoading}
            >
              {isLoading ? "Verifying..." : "Enter"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            {/* Current Status */}
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              isClockedIn 
                ? "bg-green-500/20 text-green-600" 
                : "bg-muted text-muted-foreground"
            }`}>
              {isClockedIn 
                ? `Clocked in at ${formatTime(activeShift?.clock_in || "")}` 
                : "Not clocked in"
              }
            </div>

            {/* Message */}
            {message && (
              <p className={`text-sm text-center ${
                message.includes("successfully") ? "text-green-600" : "text-destructive"
              }`}>
                {message}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 w-full max-w-[280px]">
              {!isClockedIn ? (
                <Button 
                  className="flex-1 h-14 text-lg gap-2"
                  onClick={() => handleClockAction("clock_in")}
                  disabled={isLoading}
                >
                  <LogIn className="h-5 w-5" />
                  Clock In
                </Button>
              ) : (
                <Button 
                  variant="destructive"
                  className="flex-1 h-14 text-lg gap-2"
                  onClick={() => handleClockAction("clock_out")}
                  disabled={isLoading}
                >
                  <LogOut className="h-5 w-5" />
                  Clock Out
                </Button>
              )}
            </div>

            {/* Back Button */}
            <Button 
              variant="ghost" 
              className="mt-2"
              onClick={resetState}
            >
              Use Different PIN
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
