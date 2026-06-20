"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Home, Plus, Pencil, Trash2, ArrowLeft, Beer, Wine } from "lucide-react"

interface BarMenuItem {
  id: string
  name: string
  category: string | null
  price: number | null
}

interface BarTap {
  id: string
  name: string
  menu_item_id: string | null
  created_at: string
  menu_item?: BarMenuItem | null
}

const NONE_VALUE = "__none__"

export default function BarPage() {
  const [taps, setTaps] = useState<BarTap[]>([])
  const [menuItems, setMenuItems] = useState<BarMenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTap, setSelectedTap] = useState<BarTap | null>(null)
  const [formData, setFormData] = useState({ name: "", menu_item_id: NONE_VALUE })
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const supabase = createClient()

  const fetchData = async () => {
    setIsLoading(true)
    const [tapsRes, menuRes] = await Promise.all([
      supabase
        .from("bar_taps")
        .select("*, menu_item:bar_menu_items(id, name, category, price)")
        .order("created_at", { ascending: true }),
      supabase.from("bar_menu_items").select("id, name, category, price").order("name", { ascending: true }),
    ])

    if (tapsRes.error) {
      console.error("Failed to fetch taps:", tapsRes.error)
    } else {
      setTaps((tapsRes.data as BarTap[]) || [])
    }

    if (menuRes.error) {
      console.error("Failed to fetch menu items:", menuRes.error)
    } else {
      setMenuItems((menuRes.data as BarMenuItem[]) || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const resetForm = () => {
    setFormData({ name: "", menu_item_id: NONE_VALUE })
    setError("")
  }

  const handleAdd = async () => {
    setError("")
    if (!formData.name.trim()) {
      setError("Tap name is required")
      return
    }

    setIsSaving(true)
    const { error: insertError } = await supabase.from("bar_taps").insert({
      name: formData.name.trim(),
      menu_item_id: formData.menu_item_id === NONE_VALUE ? null : formData.menu_item_id,
    })

    if (insertError) {
      setError("Failed to add tap")
      console.error(insertError)
    } else {
      setIsAddDialogOpen(false)
      resetForm()
      fetchData()
    }
    setIsSaving(false)
  }

  const handleEdit = async () => {
    if (!selectedTap) return
    setError("")
    if (!formData.name.trim()) {
      setError("Tap name is required")
      return
    }

    setIsSaving(true)
    const { error: updateError } = await supabase
      .from("bar_taps")
      .update({
        name: formData.name.trim(),
        menu_item_id: formData.menu_item_id === NONE_VALUE ? null : formData.menu_item_id,
      })
      .eq("id", selectedTap.id)

    if (updateError) {
      setError("Failed to update tap")
      console.error(updateError)
    } else {
      setIsEditDialogOpen(false)
      setSelectedTap(null)
      resetForm()
      fetchData()
    }
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedTap) return

    const { error: deleteError } = await supabase.from("bar_taps").delete().eq("id", selectedTap.id)

    if (deleteError) {
      console.error("Failed to delete tap:", deleteError)
      alert("Failed to delete tap.")
    } else {
      setIsDeleteDialogOpen(false)
      setSelectedTap(null)
      fetchData()
    }
  }

  const handleQuickAssign = async (tap: BarTap, value: string) => {
    const menu_item_id = value === NONE_VALUE ? null : value
    const { error: updateError } = await supabase
      .from("bar_taps")
      .update({ menu_item_id })
      .eq("id", tap.id)

    if (updateError) {
      console.error("Failed to assign menu item:", updateError)
      alert("Failed to assign menu item.")
    } else {
      fetchData()
    }
  }

  const openAddDialog = () => {
    resetForm()
    setIsAddDialogOpen(true)
  }

  const openEditDialog = (tap: BarTap) => {
    setSelectedTap(tap)
    setFormData({ name: tap.name, menu_item_id: tap.menu_item_id || NONE_VALUE })
    setError("")
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (tap: BarTap) => {
    setSelectedTap(tap)
    setIsDeleteDialogOpen(true)
  }

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
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
              <Beer className="h-6 w-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bar Taps</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/bar-menu">
              <Button variant="outline" size="sm" className="gap-1">
                <Wine className="h-4 w-4" />
                Bar Menu
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-1">
                <Home className="h-4 w-4" />
                Front
              </Button>
            </Link>
          </div>
        </header>

        {/* Add Button */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Tap
          </Button>
          {menuItems.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">
              No bar menu items yet.{" "}
              <Link href="/admin/bar-menu" className="text-primary underline">
                Add some
              </Link>{" "}
              to assign them to taps.
            </p>
          )}
        </div>

        {/* Taps Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading taps...</div>
        ) : taps.length === 0 ? (
          <div className="bg-card border border-border rounded-lg text-center py-12 text-muted-foreground">
            No taps yet. Create your first tap to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {taps.map((tap) => (
              <div key={tap.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Beer className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{tap.name}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => openEditDialog(tap)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => openDeleteDialog(tap)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-md bg-muted/50 px-3 py-2">
                  {tap.menu_item ? (
                    <div>
                      <div className="font-medium text-foreground">{tap.menu_item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {tap.menu_item.category || "Uncategorised"}
                        {tap.menu_item.price != null && ` · £${tap.menu_item.price.toFixed(2)}`}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Empty tap</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Assigned item</Label>
                  <Select
                    value={tap.menu_item_id || NONE_VALUE}
                    onValueChange={(value) => handleQuickAssign(tap, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Empty tap</SelectItem>
                      {menuItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tap</DialogTitle>
              <DialogDescription>Create a new bar tap and optionally assign a menu item.</DialogDescription>
            </DialogHeader>
            <TapForm
              formData={formData}
              setFormData={setFormData}
              menuItems={menuItems}
              error={error}
              idPrefix="add"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={isSaving}>
                {isSaving ? "Adding..." : "Add Tap"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tap</DialogTitle>
              <DialogDescription>Update the tap name or assigned menu item.</DialogDescription>
            </DialogHeader>
            <TapForm
              formData={formData}
              setFormData={setFormData}
              menuItems={menuItems}
              error={error}
              idPrefix="edit"
            />
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

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tap</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedTap?.name}? This action cannot be undone.
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

function TapForm({
  formData,
  setFormData,
  menuItems,
  error,
  idPrefix,
}: {
  formData: { name: string; menu_item_id: string }
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; menu_item_id: string }>>
  menuItems: BarMenuItem[]
  error: string
  idPrefix: string
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-tap-name`}>Tap Name</Label>
        <Input
          id={`${idPrefix}-tap-name`}
          placeholder="e.g. Tap 1"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-tap-item`}>Assigned Menu Item</Label>
        <Select
          value={formData.menu_item_id}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, menu_item_id: value }))}
        >
          <SelectTrigger id={`${idPrefix}-tap-item`}>
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>Empty tap</SelectItem>
            {menuItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
                {item.category ? ` (${item.category})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
