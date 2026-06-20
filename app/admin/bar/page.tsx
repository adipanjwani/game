"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Home, Plus, Pencil, Trash2, ArrowLeft, Beer, Wine } from "lucide-react"

interface BarMenuItem {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  created_at: string
}

interface BarTap {
  id: string
  name: string
  menu_item_id: string | null
  created_at: string
  menu_item?: BarMenuItem | null
}

const NONE_VALUE = "__none__"

type Section = "taps" | "menu"

export default function BarPage() {
  const [section, setSection] = useState<Section>("taps")
  const [taps, setTaps] = useState<BarTap[]>([])
  const [menuItems, setMenuItems] = useState<BarMenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Tap dialogs
  const [isAddTapOpen, setIsAddTapOpen] = useState(false)
  const [isEditTapOpen, setIsEditTapOpen] = useState(false)
  const [isDeleteTapOpen, setIsDeleteTapOpen] = useState(false)
  const [selectedTap, setSelectedTap] = useState<BarTap | null>(null)
  const [tapForm, setTapForm] = useState({ name: "", menu_item_id: NONE_VALUE })
  const [tapError, setTapError] = useState("")
  const [isSavingTap, setIsSavingTap] = useState(false)

  // Menu dialogs
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [isEditItemOpen, setIsEditItemOpen] = useState(false)
  const [isDeleteItemOpen, setIsDeleteItemOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<BarMenuItem | null>(null)
  const [itemForm, setItemForm] = useState({ name: "", description: "", price: "", category: "" })
  const [itemError, setItemError] = useState("")
  const [isSavingItem, setIsSavingItem] = useState(false)

  const supabase = createClient()

  const fetchData = async () => {
    setIsLoading(true)
    const [tapsRes, menuRes] = await Promise.all([
      supabase
        .from("bar_taps")
        .select("*, menu_item:bar_menu_items(id, name, category, price)")
        .order("created_at", { ascending: true }),
      supabase.from("bar_menu_items").select("*").order("name", { ascending: true }),
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

  /* ---------- Tap handlers ---------- */
  const resetTapForm = () => {
    setTapForm({ name: "", menu_item_id: NONE_VALUE })
    setTapError("")
  }

  const handleAddTap = async () => {
    setTapError("")
    if (!tapForm.name.trim()) {
      setTapError("Tap name is required")
      return
    }
    setIsSavingTap(true)
    const { error } = await supabase.from("bar_taps").insert({
      name: tapForm.name.trim(),
      menu_item_id: tapForm.menu_item_id === NONE_VALUE ? null : tapForm.menu_item_id,
    })
    if (error) {
      setTapError("Failed to add tap")
      console.error(error)
    } else {
      setIsAddTapOpen(false)
      resetTapForm()
      fetchData()
    }
    setIsSavingTap(false)
  }

  const handleEditTap = async () => {
    if (!selectedTap) return
    setTapError("")
    if (!tapForm.name.trim()) {
      setTapError("Tap name is required")
      return
    }
    setIsSavingTap(true)
    const { error } = await supabase
      .from("bar_taps")
      .update({
        name: tapForm.name.trim(),
        menu_item_id: tapForm.menu_item_id === NONE_VALUE ? null : tapForm.menu_item_id,
      })
      .eq("id", selectedTap.id)
    if (error) {
      setTapError("Failed to update tap")
      console.error(error)
    } else {
      setIsEditTapOpen(false)
      setSelectedTap(null)
      resetTapForm()
      fetchData()
    }
    setIsSavingTap(false)
  }

  const handleDeleteTap = async () => {
    if (!selectedTap) return
    const { error } = await supabase.from("bar_taps").delete().eq("id", selectedTap.id)
    if (error) {
      console.error("Failed to delete tap:", error)
      alert("Failed to delete tap.")
    } else {
      setIsDeleteTapOpen(false)
      setSelectedTap(null)
      fetchData()
    }
  }

  const handleQuickAssign = async (tap: BarTap, value: string) => {
    const menu_item_id = value === NONE_VALUE ? null : value
    const { error } = await supabase.from("bar_taps").update({ menu_item_id }).eq("id", tap.id)
    if (error) {
      console.error("Failed to assign menu item:", error)
      alert("Failed to assign menu item.")
    } else {
      fetchData()
    }
  }

  const openAddTap = () => {
    resetTapForm()
    setIsAddTapOpen(true)
  }

  const openEditTap = (tap: BarTap) => {
    setSelectedTap(tap)
    setTapForm({ name: tap.name, menu_item_id: tap.menu_item_id || NONE_VALUE })
    setTapError("")
    setIsEditTapOpen(true)
  }

  const openDeleteTap = (tap: BarTap) => {
    setSelectedTap(tap)
    setIsDeleteTapOpen(true)
  }

  /* ---------- Menu item handlers ---------- */
  const resetItemForm = () => {
    setItemForm({ name: "", description: "", price: "", category: "" })
    setItemError("")
  }

  const validateItem = (): boolean => {
    if (!itemForm.name.trim()) {
      setItemError("Name is required")
      return false
    }
    if (itemForm.price && isNaN(Number(itemForm.price))) {
      setItemError("Price must be a valid number")
      return false
    }
    return true
  }

  const handleAddItem = async () => {
    setItemError("")
    if (!validateItem()) return
    setIsSavingItem(true)
    const { error } = await supabase.from("bar_menu_items").insert({
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || null,
      price: itemForm.price ? Number(itemForm.price) : null,
      category: itemForm.category.trim() || null,
    })
    if (error) {
      setItemError("Failed to add menu item")
      console.error(error)
    } else {
      setIsAddItemOpen(false)
      resetItemForm()
      fetchData()
    }
    setIsSavingItem(false)
  }

  const handleEditItem = async () => {
    if (!selectedItem) return
    setItemError("")
    if (!validateItem()) return
    setIsSavingItem(true)
    const { error } = await supabase
      .from("bar_menu_items")
      .update({
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || null,
        price: itemForm.price ? Number(itemForm.price) : null,
        category: itemForm.category.trim() || null,
      })
      .eq("id", selectedItem.id)
    if (error) {
      setItemError("Failed to update menu item")
      console.error(error)
    } else {
      setIsEditItemOpen(false)
      setSelectedItem(null)
      resetItemForm()
      fetchData()
    }
    setIsSavingItem(false)
  }

  const handleDeleteItem = async () => {
    if (!selectedItem) return
    const { error } = await supabase.from("bar_menu_items").delete().eq("id", selectedItem.id)
    if (error) {
      console.error("Failed to delete menu item:", error)
      alert("Failed to delete menu item.")
    } else {
      setIsDeleteItemOpen(false)
      setSelectedItem(null)
      fetchData()
    }
  }

  const openAddItem = () => {
    resetItemForm()
    setIsAddItemOpen(true)
  }

  const openEditItem = (item: BarMenuItem) => {
    setSelectedItem(item)
    setItemForm({
      name: item.name,
      description: item.description || "",
      price: item.price != null ? String(item.price) : "",
      category: item.category || "",
    })
    setItemError("")
    setIsEditItemOpen(true)
  }

  const openDeleteItem = (item: BarMenuItem) => {
    setSelectedItem(item)
    setIsDeleteItemOpen(true)
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
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bar</h1>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1">
              <Home className="h-4 w-4" />
              Front
            </Button>
          </Link>
        </header>

        {/* Section Toggle */}
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-1 mb-6">
          <Button
            variant={section === "taps" ? "default" : "ghost"}
            size="sm"
            className="gap-1"
            onClick={() => setSection("taps")}
          >
            <Beer className="h-4 w-4" />
            Taps
          </Button>
          <Button
            variant={section === "menu" ? "default" : "ghost"}
            size="sm"
            className="gap-1"
            onClick={() => setSection("menu")}
          >
            <Wine className="h-4 w-4" />
            Menu Items
          </Button>
        </div>

        {/* ---------- TAPS SECTION ---------- */}
        {section === "taps" && (
          <div>
            <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
              <Button onClick={openAddTap} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Tap
              </Button>
              {menuItems.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground">
                  No bar menu items yet. Add some in the{" "}
                  <button className="text-primary underline" onClick={() => setSection("menu")}>
                    Menu Items
                  </button>{" "}
                  tab to assign them to taps.
                </p>
              )}
            </div>

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
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditTap(tap)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => openDeleteTap(tap)}
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
          </div>
        )}

        {/* ---------- MENU SECTION ---------- */}
        {section === "menu" && (
          <div>
            <div className="mb-6">
              <Button onClick={openAddItem} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Menu Item
              </Button>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading menu items...</div>
              ) : menuItems.length === 0 ? (
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
                    {menuItems.map((item) => (
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
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditItem(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1"
                              onClick={() => openDeleteItem(item)}
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
          </div>
        )}

        {/* ---------- Tap Dialogs ---------- */}
        <Dialog open={isAddTapOpen} onOpenChange={setIsAddTapOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tap</DialogTitle>
              <DialogDescription>Create a new bar tap and optionally assign a menu item.</DialogDescription>
            </DialogHeader>
            <TapForm formData={tapForm} setFormData={setTapForm} menuItems={menuItems} error={tapError} idPrefix="add" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddTapOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddTap} disabled={isSavingTap}>
                {isSavingTap ? "Adding..." : "Add Tap"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditTapOpen} onOpenChange={setIsEditTapOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tap</DialogTitle>
              <DialogDescription>Update the tap name or assigned menu item.</DialogDescription>
            </DialogHeader>
            <TapForm formData={tapForm} setFormData={setTapForm} menuItems={menuItems} error={tapError} idPrefix="edit" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditTapOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditTap} disabled={isSavingTap}>
                {isSavingTap ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteTapOpen} onOpenChange={setIsDeleteTapOpen}>
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
                onClick={handleDeleteTap}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ---------- Menu Item Dialogs ---------- */}
        <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Menu Item</DialogTitle>
              <DialogDescription>Enter the details for the new bar menu item.</DialogDescription>
            </DialogHeader>
            <BarItemForm formData={itemForm} setFormData={setItemForm} error={itemError} idPrefix="add" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem} disabled={isSavingItem}>
                {isSavingItem ? "Adding..." : "Add Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Menu Item</DialogTitle>
              <DialogDescription>Update the bar menu item details.</DialogDescription>
            </DialogHeader>
            <BarItemForm formData={itemForm} setFormData={setItemForm} error={itemError} idPrefix="edit" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditItemOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditItem} disabled={isSavingItem}>
                {isSavingItem ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteItemOpen} onOpenChange={setIsDeleteItemOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedItem?.name}? This action cannot be undone. Any taps using this
                item will be cleared.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteItem}
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
