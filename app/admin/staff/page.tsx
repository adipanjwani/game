"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Users,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react"
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
  created_at: string
}

interface TimeEntry {
  id: string
  staff_id: string
  clock_in: string
  clock_out: string | null
  created_at: string
}

interface StaffWithHours extends Staff {
  weeklyHours: number
  isClockedIn: boolean
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffWithHours[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [newName, setNewName] = useState("")
  const [newPin, setNewPin] = useState("")
  const [showPin, setShowPin] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const calculateWeeklyHours = useCallback(async (staffId: string): Promise<number> => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

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

  const checkClockedIn = useCallback(async (staffId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("time_clock")
      .select("id")
      .eq("staff_id", staffId)
      .is("clock_out", null)
      .single()

    return !!data
  }, [supabase])

  const fetchStaff = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Failed to fetch staff:", error)
      setIsLoading(false)
      return
    }

    // Get weekly hours and clock status for each staff member
    const staffWithHours = await Promise.all(
      (data || []).map(async (s) => ({
        ...s,
        weeklyHours: await calculateWeeklyHours(s.id),
        isClockedIn: await checkClockedIn(s.id),
      }))
    )

    setStaff(staffWithHours)
    setIsLoading(false)
  }, [supabase, calculateWeeklyHours, checkClockedIn])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  const generatePin = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString()
    setNewPin(pin)
  }

  const handleAddStaff = async () => {
    if (!newName.trim()) {
      setError("Name is required")
      return
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits")
      return
    }

    // Check if PIN already exists
    const { data: existing } = await supabase
      .from("staff")
      .select("id")
      .eq("pin", newPin)
      .single()

    if (existing) {
      setError("This PIN is already in use. Please choose another.")
      return
    }

    const { error: insertError } = await supabase.from("staff").insert({
      name: newName.trim(),
      pin: newPin,
      is_active: true,
    })

    if (insertError) {
      setError("Failed to add staff member")
      return
    }

    setNewName("")
    setNewPin("")
    setError(null)
    setIsAddDialogOpen(false)
    fetchStaff()
  }

  const handleEditStaff = async () => {
    if (!editingStaff) return
    if (!newName.trim()) {
      setError("Name is required")
      return
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits")
      return
    }

    // Check if PIN already exists (excluding current staff)
    const { data: existing } = await supabase
      .from("staff")
      .select("id")
      .eq("pin", newPin)
      .neq("id", editingStaff.id)
      .single()

    if (existing) {
      setError("This PIN is already in use. Please choose another.")
      return
    }

    const { error: updateError } = await supabase
      .from("staff")
      .update({ name: newName.trim(), pin: newPin })
      .eq("id", editingStaff.id)

    if (updateError) {
      setError("Failed to update staff member")
      return
    }

    setNewName("")
    setNewPin("")
    setError(null)
    setEditingStaff(null)
    setIsEditDialogOpen(false)
    fetchStaff()
  }

  const handleToggleActive = async (staffMember: Staff) => {
    const { error } = await supabase
      .from("staff")
      .update({ is_active: !staffMember.is_active })
      .eq("id", staffMember.id)

    if (error) {
      console.error("Failed to toggle staff status:", error)
      return
    }

    fetchStaff()
  }

  const handleDeleteStaff = async (staffMember: Staff) => {
    if (
      !confirm(
        `Are you sure you want to delete ${staffMember.name}? This will also delete all their time records.`
      )
    ) {
      return
    }

    // Delete time entries first
    await supabase.from("time_clock").delete().eq("staff_id", staffMember.id)

    // Then delete staff
    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", staffMember.id)

    if (error) {
      console.error("Failed to delete staff:", error)
      return
    }

    fetchStaff()
  }

  const openEditDialog = (staffMember: Staff) => {
    setEditingStaff(staffMember)
    setNewName(staffMember.name)
    setNewPin(staffMember.pin)
    setError(null)
    setIsEditDialogOpen(true)
  }

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const activeStaff = staff.filter((s) => s.is_active)
  const clockedInCount = staff.filter((s) => s.isClockedIn).length

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Staff Management
            </h1>
          </div>
          <Link href="/clock">
            <Button variant="outline" size="sm" className="gap-2">
              <Clock className="h-4 w-4" />
              Clock Page
            </Button>
          </Link>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Staff</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{staff.length}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <div className="text-2xl font-bold text-green-500">{activeStaff.length}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Clocked In</span>
            </div>
            <div className="text-2xl font-bold text-blue-500">{clockedInCount}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => {
                setNewName("")
                setNewPin("")
                setError(null)
              }}>
                <Plus className="h-4 w-4" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Staff Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter staff name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN (4 digits)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pin"
                      placeholder="0000"
                      maxLength={4}
                      value={newPin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "")
                        setNewPin(val)
                      }}
                    />
                    <Button variant="outline" onClick={generatePin}>
                      Generate
                    </Button>
                  </div>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleAddStaff}>Add Staff</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={fetchStaff} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Staff Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : staff.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No staff members yet. Add your first staff member above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Weekly Hours</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {showPin === member.id ? member.pin : "••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() =>
                            setShowPin(showPin === member.id ? null : member.id)
                          }
                        >
                          {showPin === member.id ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={member.is_active ? "default" : "secondary"}
                          className={
                            member.is_active
                              ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                              : ""
                          }
                        >
                          {member.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {member.isClockedIn && (
                          <Badge
                            variant="outline"
                            className="border-blue-500 text-blue-500"
                          >
                            Clocked In
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatHours(member.weeklyHours)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditDialog(member)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 px-2 text-xs ${
                            member.is_active
                              ? "text-amber-500 hover:text-amber-600"
                              : "text-green-500 hover:text-green-600"
                          }`}
                          onClick={() => handleToggleActive(member)}
                        >
                          {member.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteStaff(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  placeholder="Enter staff name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pin">PIN (4 digits)</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-pin"
                    placeholder="0000"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "")
                      setNewPin(val)
                    }}
                  />
                  <Button variant="outline" onClick={generatePin}>
                    Generate
                  </Button>
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleEditStaff}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
