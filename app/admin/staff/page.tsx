"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Home, ChefHat, Plus, Trash2, Edit2, X, Check, Clock, Users } from "lucide-react"

interface Staff {
  id: string
  name: string
  pin: string
  is_active: boolean
  created_at: string
}

interface TimeEntry {
  id: string
  staff_id: string
  clock_in: string
  clock_out: string | null
  staff?: { id: string; name: string }
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newPin, setNewPin] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editPin, setEditPin] = useState("")
  const [error, setError] = useState("")

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/staff")
      const data = await res.json()
      if (data.staff) {
        setStaff(data.staff)
      }
    } catch (err) {
      console.error("Failed to fetch staff:", err)
    }
  }

  const fetchTimeEntries = async () => {
    try {
      const res = await fetch("/api/time-clock")
      const data = await res.json()
      if (data.entries) {
        setTimeEntries(data.entries)
      }
    } catch (err) {
      console.error("Failed to fetch time entries:", err)
    }
  }

  useEffect(() => {
    Promise.all([fetchStaff(), fetchTimeEntries()]).finally(() => setIsLoading(false))
  }, [])

  const handleAddStaff = async () => {
    setError("")
    if (!newName.trim() || !newPin.trim()) {
      setError("Name and PIN are required")
      return
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits")
      return
    }

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), pin: newPin }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || "Failed to add staff")
        return
      }

      setNewName("")
      setNewPin("")
      fetchStaff()
    } catch (err) {
      setError("Failed to add staff")
    }
  }

  const handleUpdateStaff = async (id: string) => {
    setError("")
    if (!editName.trim()) {
      setError("Name is required")
      return
    }
    if (editPin && (editPin.length !== 4 || !/^\d{4}$/.test(editPin))) {
      setError("PIN must be exactly 4 digits")
      return
    }

    try {
      const res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id, 
          name: editName.trim(), 
          pin: editPin || undefined 
        }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || "Failed to update staff")
        return
      }

      setEditingId(null)
      fetchStaff()
    } catch (err) {
      setError("Failed to update staff")
    }
  }

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return

    try {
      await fetch(`/api/staff?id=${id}`, { method: "DELETE" })
      fetchStaff()
    } catch (err) {
      setError("Failed to delete staff")
    }
  }

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    try {
      await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !currentlyActive }),
      })
      fetchStaff()
    } catch (err) {
      setError("Failed to update staff status")
    }
  }

  const startEditing = (member: Staff) => {
    setEditingId(member.id)
    setEditName(member.name)
    setEditPin("")
    setError("")
  }

  const calculateWeeklyHours = (staffId: string) => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - dayOfWeek)
    startOfWeek.setHours(0, 0, 0, 0)

    const staffEntries = timeEntries.filter(
      (entry) => entry.staff_id === staffId && new Date(entry.clock_in) >= startOfWeek
    )

    let totalMs = 0
    for (const entry of staffEntries) {
      const clockIn = new Date(entry.clock_in)
      const clockOut = entry.clock_out ? new Date(entry.clock_out) : new Date()
      totalMs += clockOut.getTime() - clockIn.getTime()
    }

    const hours = Math.floor(totalMs / (1000 * 60 * 60))
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60))
    return { hours, minutes }
  }

  const isClockedIn = (staffId: string) => {
    return timeEntries.some((entry) => entry.staff_id === staffId && !entry.clock_out)
  }

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Staff Management</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="gap-1">
                <Users className="h-4 w-4" />
                Admin
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

        {/* Add Staff Form */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Staff
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Staff name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="4-digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full sm:w-32"
              maxLength={4}
              type="text"
              inputMode="numeric"
            />
            <Button onClick={handleAddStaff} className="gap-1">
              <Plus className="h-4 w-4" />
              Add Staff
            </Button>
          </div>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>

        {/* Staff List */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Members
          </h2>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : staff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No staff members yet</div>
          ) : (
            <div className="space-y-3">
              {staff.map((member) => {
                const weeklyHours = calculateWeeklyHours(member.id)
                const clockedIn = isClockedIn(member.id)

                return (
                  <div
                    key={member.id}
                    className={`border rounded-lg p-4 ${
                      member.is_active 
                        ? "bg-card border-border" 
                        : "bg-muted/30 border-muted"
                    }`}
                  >
                    {editingId === member.id ? (
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="New PIN (optional)"
                          value={editPin}
                          onChange={(e) => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="w-full sm:w-36"
                          maxLength={4}
                          type="text"
                          inputMode="numeric"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateStaff(member.id)}
                            className="gap-1"
                          >
                            <Check className="h-4 w-4" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{member.name}</span>
                            {clockedIn && (
                              <span className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded">
                                Clocked In
                              </span>
                            )}
                            {!member.is_active && (
                              <span className="text-xs bg-red-500/20 text-red-600 px-2 py-0.5 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            PIN: {member.pin}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <Clock className="h-3.5 w-3.5" />
                            This week: {weeklyHours.hours}h {weeklyHours.minutes}m
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={member.is_active ? "secondary" : "default"}
                            onClick={() => handleToggleActive(member.id, member.is_active)}
                          >
                            {member.is_active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(member)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteStaff(member.id, member.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
