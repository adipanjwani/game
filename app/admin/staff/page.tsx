"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Home, ChefHat, Plus, Pencil, Trash2, Users, ArrowLeft, Eye, EyeOff, Clock } from "lucide-react"

interface Staff {
  id: string
  name: string
  pin: string
  is_active: boolean
  created_at: string
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [formData, setFormData] = useState({ name: "", pin: "", is_active: true })
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [showPins, setShowPins] = useState<Record<string, boolean>>({})

  const supabase = createClient()

  const fetchStaff = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      console.error("Failed to fetch staff:", error)
    } else {
      setStaff(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  const validatePin = (pin: string): boolean => {
    return /^\d{4}$/.test(pin)
  }

  const checkPinUnique = async (pin: string, excludeId?: string): Promise<boolean> => {
    const { data } = await supabase
      .from("staff")
      .select("id")
      .eq("pin", pin)
      .neq("id", excludeId || "")

    return !data || data.length === 0
  }

  const handleAdd = async () => {
    setError("")

    if (!formData.name.trim()) {
      setError("Name is required")
      return
    }

    if (!validatePin(formData.pin)) {
      setError("PIN must be exactly 4 digits")
      return
    }

    const isPinUnique = await checkPinUnique(formData.pin)
    if (!isPinUnique) {
      setError("This PIN is already in use by another staff member")
      return
    }

    setIsSaving(true)
    const { error: insertError } = await supabase.from("staff").insert({
      name: formData.name.trim(),
      pin: formData.pin,
      is_active: formData.is_active,
    })

    if (insertError) {
      setError("Failed to add staff member")
      console.error(insertError)
    } else {
      setIsAddDialogOpen(false)
      setFormData({ name: "", pin: "", is_active: true })
      fetchStaff()
    }
    setIsSaving(false)
  }

  const handleEdit = async () => {
    if (!selectedStaff) return
    setError("")

    if (!formData.name.trim()) {
      setError("Name is required")
      return
    }

    if (!validatePin(formData.pin)) {
      setError("PIN must be exactly 4 digits")
      return
    }

    const isPinUnique = await checkPinUnique(formData.pin, selectedStaff.id)
    if (!isPinUnique) {
      setError("This PIN is already in use by another staff member")
      return
    }

    setIsSaving(true)
    const { error: updateError } = await supabase
      .from("staff")
      .update({
        name: formData.name.trim(),
        pin: formData.pin,
        is_active: formData.is_active,
      })
      .eq("id", selectedStaff.id)

    if (updateError) {
      setError("Failed to update staff member")
      console.error(updateError)
    } else {
      setIsEditDialogOpen(false)
      setSelectedStaff(null)
      setFormData({ name: "", pin: "", is_active: true })
      fetchStaff()
    }
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedStaff) return

    const { error: deleteError } = await supabase
      .from("staff")
      .delete()
      .eq("id", selectedStaff.id)

    if (deleteError) {
      console.error("Failed to delete staff:", deleteError)
      alert("Failed to delete staff member. They may have time clock records.")
    } else {
      setIsDeleteDialogOpen(false)
      setSelectedStaff(null)
      fetchStaff()
    }
  }

  const openEditDialog = (staffMember: Staff) => {
    setSelectedStaff(staffMember)
    setFormData({
      name: staffMember.name,
      pin: staffMember.pin,
      is_active: staffMember.is_active,
    })
    setError("")
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (staffMember: Staff) => {
    setSelectedStaff(staffMember)
    setIsDeleteDialogOpen(true)
  }

  const openAddDialog = () => {
    setFormData({ name: "", pin: "", is_active: true })
    setError("")
    setIsAddDialogOpen(true)
  }

  const togglePinVisibility = (id: string) => {
    setShowPins((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handlePinInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4)
    setFormData((prev) => ({ ...prev, pin: digits }))
  }

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
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
              <Users className="h-6 w-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Staff Management</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/timesheet">
              <Button variant="outline" size="sm" className="gap-1">
                <Clock className="h-4 w-4" />
                Timesheet
              </Button>
            </Link>
            <Link href="/admin/hours">
              <Button variant="outline" size="sm" className="gap-1">
                <Users className="h-4 w-4" />
                Hours
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

        {/* Add Staff Button */}
        <div className="mb-6">
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Staff Member
          </Button>
        </div>

        {/* Staff Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading staff...</div>
          ) : staff.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No staff members yet. Add your first staff member to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
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
                          {showPins[member.id] ? member.pin : "••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => togglePinVisibility(member.id)}
                        >
                          {showPins[member.id] ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          member.is_active
                            ? "bg-green-500/20 text-green-600"
                            : "bg-red-500/20 text-red-600"
                        }`}
                      >
                        {member.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => openEditDialog(member)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          onClick={() => openDeleteDialog(member)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Add Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>
                Enter the details for the new staff member. The PIN must be exactly 4 digits.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Name</Label>
                <Input
                  id="add-name"
                  placeholder="Enter staff name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-pin">PIN (4 digits)</Label>
                <Input
                  id="add-pin"
                  placeholder="0000"
                  value={formData.pin}
                  onChange={(e) => handlePinInput(e.target.value)}
                  maxLength={4}
                  className="font-mono text-lg tracking-widest"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="add-active">Active Status</Label>
                <Switch
                  id="add-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={isSaving}>
                {isSaving ? "Adding..." : "Add Staff"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Staff Member</DialogTitle>
              <DialogDescription>
                Update the staff member&apos;s details. The PIN must be exactly 4 digits.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  placeholder="Enter staff name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pin">PIN (4 digits)</Label>
                <Input
                  id="edit-pin"
                  placeholder="0000"
                  value={formData.pin}
                  onChange={(e) => handlePinInput(e.target.value)}
                  maxLength={4}
                  className="font-mono text-lg tracking-widest"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-active">Active Status</Label>
                <Switch
                  id="edit-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedStaff?.name}? This action cannot be undone.
                {selectedStaff && " Any associated time clock records may also be affected."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
