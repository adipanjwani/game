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
  tap_limit: number | null
  created_at: string
}

interface BarAddon {
  id: string
  name: string
  price: number
  created_at: string
}

type Section = "taps" | "menu" | "addons"

export default function BarPage() {
  const [section, setSection] = useState<Section>("taps")
  const [taps, setTaps] = useState<BarTap[]>([])
  const [menuItems, setMenuItems] = useState<BarMenuItem[]>([])
  const [addons, setAddons] = useState<BarAddon[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Tap dialogs
  const [isAddTapOpen, setIsAddTapOpen] = useState(false)
  const [isEditTapOpen, setIsEditTapOpen] = useState(false)
  const [isDeleteTapOpen, setIsDeleteTapOpen] = useState(false)
  const [selectedTap, setSelectedTap] = useState<BarTap | null>(null)
  const [tapForm, setTapForm] = useState({ name: "", tap_limit: "" })
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

  // Add-on dialogs
  const [isAddAddonOpen, setIsAddAddonOpen] = useState(false)
  const [isEditAddonOpen, setIsEditAddonOpen] = useState(false)
  const [isDeleteAddonOpen, setIsDeleteAddonOpen] = useState(false)
  const [selectedAddon, setSelectedAddon] = useState<BarAddon | null>(null)
  const [addonForm, setAddonForm] = useState({ name: "", price: "" })
  const [addonError, setAddonError] = useState("")
  const [isSavingAddon, setIsSavingAddon] = useState(false)

  const supabase = createClient()

  const fetchData = async () => {
    setIsLoading(true)
    const [tapsRes, menuRes, addonsRes] = await Promise.all([
      supabase
        .from("bar_taps")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase.from("bar_menu_items").select("*").order("name", { ascending: true }),
      supabase.from("bar_addons").select("*").order("name", { ascending: true }),
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

    if (addonsRes.error) {
      console.error("Failed to fetch add-ons:", addonsRes.error)
    } else {
      setAddons((addonsRes.data as BarAddon[]) || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  /* ---------- Tap handlers ---------- */
  const resetTapForm = () => {
    setTapForm({ name: "", tap_limit: "" })
    setTapError("")
  }

  const handleAddTap = async () => {
    setTapError("")
    if (!tapForm.name.trim()) {
      setTapError("Tap name is required")
      return
    }
    if (tapForm.tap_limit && (isNaN(Number(tapForm.tap_limit)) || Number(tapForm.tap_limit) < 0)) {
      setTapError("Tap limit must be a valid positive number")
      return
    }
    setIsSavingTap(true)
    const { error } = await supabase.from("bar_taps").insert({
      name: tapForm.name.trim(),
      tap_limit: tapForm.tap_limit ? Number(tapForm.tap_limit) : null,
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
    if (tapForm.tap_limit && (isNaN(Number(tapForm.tap_limit)) || Number(tapForm.tap_limit) < 0)) {
      setTapError("Tap limit must be a valid positive number")
      return
    }
    setIsSavingTap(true)
    const { error } = await supabase
      .from("bar_taps")
      .update({
        name: tapForm.name.trim(),
        tap_limit: tapForm.tap_limit ? Number(tapForm.tap_limit) : null,
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

  const openAddTap = () => {
    resetTapForm()
    setIsAddTapOpen(true)
  }

  const openEditTap = (tap: BarTap) => {
    setSelectedTap(tap)
    setTapForm({
      name: tap.name,
      tap_limit: tap.tap_limit != null ? String(tap.tap_limit) : "",
    })
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

  /* ---------- Add-on handlers ---------- */
  const resetAddonForm = () => {
    setAddonForm({ name: "", price: "" })
    setAddonError("")
  }

  const validateAddon = (): boolean => {
    if (!addonForm.name.trim()) {
      setAddonError("Name is required")
      return false
    }
    if (addonForm.price && (isNaN(Number(addonForm.price)) || Number(addonForm.price) < 0)) {
      setAddonError("Price must be a valid positive number")
      return false
    }
    return true
  }

  const handleAddAddon = async () => {
    setAddonError("")
    if (!validateAddon()) return
    setIsSavingAddon(true)
    const { error } = await supabase.from("bar_addons").insert({
      name: addonForm.name.trim(),
      price: addonForm.price ? Number(addonForm.price) : 0,
    })
    if (error) {
      setAddonError("Failed to add add-on")
      console.error(error)
    } else {
      setIsAddAddonOpen(false)
      resetAddonForm()
      fetchData()
    }
    setIsSavingAddon(false)
  }

  const handleEditAddon = async () => {
    if (!selectedAddon) return
    setAddonError("")
    if (!validateAddon()) return
    setIsSavingAddon(true)
    const { error } = await supabase
      .from("bar_addons")
      .update({
        name: addonForm.name.trim(),
        price: addonForm.price ? Number(addonForm.price) : 0,
      })
      .eq("id", selectedAddon.id)
    if (error) {
      setAddonError("Failed to update add-on")
      console.error(error)
    } else {
      setIsEditAddonOpen(false)
      setSelectedAddon(null)
      resetAddonForm()
      fetchData()
    }
    setIsSavingAddon(false)
  }

  const handleDeleteAddon = async () => {
    if (!selectedAddon) return
    const { error } = await supabase.from("bar_addons").delete().eq("id", selectedAddon.id)
    if (error) {
      console.error("Failed to delete add-on:", error)
      alert("Failed to delete add-on.")
    } else {
      setIsDeleteAddonOpen(false)
      setSelectedAddon(null)
      fetchData()
    }
  }

  const openAddAddon = () => {
    resetAddonForm()
    setIsAddAddonOpen(true)
  }

  const openEditAddon = (addon: BarAddon) => {
    setSelectedAddon(addon)
    setAddonForm({ name: addon.name, price: addon.price != null ? String(addon.price) : "" })
    setAddonError("")
    setIsEditAddonOpen(true)
  }

  const openDeleteAddon = (addon: BarAddon) => {
    setSelectedAddon(addon)
    setIsDeleteAddonOpen(true)
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
          <Button
            variant={section === "addons" ? "default" : "ghost"}
            size="sm"
            className="gap-1"
            onClick={() => setSection("addons")}
          >
            <Plus className="h-4 w-4" />
            Add-ons
          </Button>
        </div>

        {/* ---------- TAPS SECTION ---------- */}
        {section === "taps" && (
          <div>
            <div className="mb-6">
              <Button onClick={openAddTap} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Tap
              </Button>
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
                        <div>
                          <h3 className="font-semibold text-foreground">{tap.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {tap.tap_limit != null ? `Limit: A$${tap.tap_limit.toFixed(2)}` : "No limit"}
                          </p>
                        </div>
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
                            {item.price != null ? `A$${item.price.toFixed(2)}` : "—"}
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

        {/* ---------- ADD-ONS SECTION ---------- */}
        {section === "addons" && (
          <div>
            <div className="mb-6">
              <Button onClick={openAddAddon} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Add-on
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Add-ons are global extras (e.g. double shot, extra mixer) that can be applied to any item at the bar.
            </p>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading add-ons...</div>
              ) : addons.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No add-ons yet. Add your first add-on to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addons.map((addon) => (
                      <TableRow key={addon.id}>
                        <TableCell className="font-medium">{addon.name}</TableCell>
                        <TableCell className="font-mono">+A${addon.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditAddon(addon)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1"
                              onClick={() => openDeleteAddon(addon)}
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
              <DialogDescription>Create a new bar tab with an optional spending limit.</DialogDescription>
            </DialogHeader>
            <TapForm formData={tapForm} setFormData={setTapForm} error={tapError} idPrefix="add" />
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
              <DialogDescription>Update the tap name or spending limit.</DialogDescription>
            </DialogHeader>
            <TapForm formData={tapForm} setFormData={setTapForm} error={tapError} idPrefix="edit" />
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

        {/* ---------- Add-on Dialogs ---------- */}
        <Dialog open={isAddAddonOpen} onOpenChange={setIsAddAddonOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Add-on</DialogTitle>
              <DialogDescription>Create a global add-on that can be applied to any item.</DialogDescription>
            </DialogHeader>
            <AddonForm formData={addonForm} setFormData={setAddonForm} error={addonError} idPrefix="add" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddAddonOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAddon} disabled={isSavingAddon}>
                {isSavingAddon ? "Adding..." : "Add Add-on"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditAddonOpen} onOpenChange={setIsEditAddonOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Add-on</DialogTitle>
              <DialogDescription>Update the add-on name or price.</DialogDescription>
            </DialogHeader>
            <AddonForm formData={addonForm} setFormData={setAddonForm} error={addonError} idPrefix="edit" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditAddonOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditAddon} disabled={isSavingAddon}>
                {isSavingAddon ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteAddonOpen} onOpenChange={setIsDeleteAddonOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Add-on</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedAddon?.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAddon}
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
  error,
  idPrefix,
}: {
  formData: { name: string; tap_limit: string }
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; tap_limit: string }>>
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
        <Label htmlFor={`${idPrefix}-tap-limit`}>Tap Limit (A$)</Label>
        <Input
          id={`${idPrefix}-tap-limit`}
          placeholder="e.g. 100.00 (optional)"
          inputMode="decimal"
          value={formData.tap_limit}
          onChange={(e) => setFormData((prev) => ({ ...prev, tap_limit: e.target.value }))}
          className="font-mono"
        />
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
              <Label htmlFor={`${idPrefix}-price`}>Price (A$)</Label>
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

function AddonForm({
  formData,
  setFormData,
  error,
  idPrefix,
}: {
  formData: { name: string; price: string }
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; price: string }>>
  error: string
  idPrefix: string
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-addon-name`}>Name</Label>
        <Input
          id={`${idPrefix}-addon-name`}
          placeholder="e.g. Double shot"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-addon-price`}>Price (A$)</Label>
        <Input
          id={`${idPrefix}-addon-price`}
          placeholder="0.00"
          inputMode="decimal"
          value={formData.price}
          onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
          className="font-mono"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
