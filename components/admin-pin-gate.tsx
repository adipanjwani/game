"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock } from "lucide-react"

const ADMIN_PIN = "8989"
const STORAGE_KEY = "admin-unlocked"

export function AdminPinGate({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isChecked, setIsChecked] = useState(false)
  const [pin, setPin] = useState("")
  const [error, setError] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "true") {
      setIsUnlocked(true)
    }
    setIsChecked(true)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem(STORAGE_KEY, "true")
      setIsUnlocked(true)
      setError(false)
    } else {
      setError(true)
      setPin("")
    }
  }

  // Avoid flashing protected content before the session check completes
  if (!isChecked) {
    return <div className="min-h-dvh bg-background" />
  }

  if (isUnlocked) {
    return <>{children}</>
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-6">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-3">
            <Lock className="h-6 w-6 text-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Admin Access</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter the PIN to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value)
              setError(false)
            }}
            placeholder="Enter PIN"
            className="text-center text-lg tracking-widest"
            aria-label="Admin PIN"
            aria-invalid={error}
          />
          {error && (
            <p className="text-sm text-destructive text-center" role="alert">
              Incorrect PIN. Please try again.
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pin.length === 0}>
            Unlock
          </Button>
        </form>
      </div>
    </div>
  )
}
