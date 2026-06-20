"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Home, Plus, Pencil, Trash2, ArrowLeft, Wine, Beer } from "lucide-react"

interface BarMenuItem {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  created_at: string
}

export default function BarMenuPage() {
  const [items, setItems] = useState<BarMenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<BarMenuItem | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "", price: "", category: "" })
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const supabase = createClient()

  const fetchItems = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("bar_menu_items")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      console.error("Failed to fetch bar menu items:", error)
    } else {
      setItems(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const resetForm = () => {
    setFormData({ name: "", description: "", price: "", category: "" })
    setError("")
  }

  const validate = (): boolean => {
    if (!formData.name.trim()) {
      setError("Name is required")
      return false
    }
    if (formData.price && isNaN(Number(formData.price))) {
      setError("Price must be a valid number")
      return false
    }
    return true
  }

  const handleAdd = async () => {
    setError("")
    if (!validate()) return

    setIsSaving(true)
    const { error: insertError } = await supabase.from("bar_menu_items").insert({
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      price: formData.price ? Number(formData.price) : null,
      category: formData.category.trim() || null,
    })

    if (insertError) {
      setError("Failed to add menu item")
      console.error(insertError)
    } else {
      setIsAddDialogOpen(false)
      resetForm()
      fetchItems()
    }
    setIsSaving(false)
  }

  const handleEdit = async () => {
    if (!selectedItem) return
    setError("")
    if (!validate()) return

    setIsSaving(true)
    const { error: updateError } = await supabase
      .from("bar_menu_items")
      .update({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: formData.price ? Number(formData.price) : null,
        category: formData.category.trim() || null,
      })
      .eq("id", selectedItem.id)

    if (updateError) {
      setError("Failed to update menu item")
      console.error(updateError)
    } else {
      setIsEditDialogOpen(false)
      setSelectedItem(null)
      resetForm()
      fetchItems()
    }
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedItem) return

    const { error: deleteError } = await supabase
      .from("bar_menu_items")
      .delete()
      .eq("id", selectedItem.id)

    if (deleteError) {
      console.error("Failed to delete menu item:", deleteError)
      alert("Failed to delete menu item.")
    } else {
      setIsDeleteDialogOpen(false)
      setSelectedItem(null)
      fetchItems()
    }
  }

  const openAddDialog = () => {
    resetForm()
    setIsAddDialogOpen(true)
  }

  const openEditDialog = (item: BarMenuItem) => {
    setSelectedItem(item)
    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price != null ? String(item.price) : "",
      category: item.category || "",
    })
    setError("")
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (item: BarMenuItem) => {
    setSelectedItem(item)
    setIsDeleteDialogOpen(true)
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
              <Wine className="h-6 w-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bar Menu</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/bar">
              <Button variant="outline" size="sm" className="gap-1">
                <Beer className="h-4 w-4" />
                Bar Taps
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
        <div className="mb-6">
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Menu Item
          </Button>
        </div>

        {/* Items Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading menu items...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No bar menu items yet. Add your first item to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.category || "—"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {item.description || "—"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {item.price != null ? `£${item.price.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => openEditDialog(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          onClick={() => openDeleteDialog(item)}
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
              <DialogTitle>Add Menu Item</DialogTitle>
              <DialogDescription>Enter the details for the new bar menu item.</DialogDescription>
            </DialogHeader>
            <BarItemForm formData={formData} setFormData={setFormData} error={error} idPrefix="add" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={isSaving}>
                {isSaving ? "Adding..." : "Add Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Menu Item</DialogTitle>
              <DialogDescription>Update the bar menu item details.</DialogDescription>
            </DialogHeader>
            <BarItemForm formData={formData} setFormData={setFormData} error={error} idPrefix="edit" />
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
              <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedItem?.name}? This action cannot be undone.
                Any taps using this item will be cleared.
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

function BarItemForm({
  formData,
  setFormData,
  error,
  idPrefix,
}: {
  formData: { name: string; description: string; price: string; category: string }
  setFormData: React.Dispatch<
    React.SetStateAction<{ name: string; description: string; price: string; category: string }>
  >
  error: string
  idPrefix: string
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="e.g. Guinness"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <Input
          id={`${idPrefix}-category`}
          placeholder="e.g. Lager, Stout, Wine"
          value={formData.category}
          onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-price`}>Price (£)</Label>
        <Input
          id={`${idPrefix}-price`}
          placeholder="0.00"
          inputMode="decimal"
          value={formData.price}
          onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
          className="font-mono"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          placeholder="Optional description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          rows={3}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
