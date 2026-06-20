"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Home, Beer, Wine, Settings, RefreshCw } from "lucide-react"

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

export default function FrontBarPage() {
  const [taps, setTaps] = useState<BarTap[]>([])
  const [menuItems, setMenuItems] = useState<BarMenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingTapId, setSavingTapId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchData = async () => {
    setIsLoading(true)
    const [tapsRes, menuRes] = await Promise.all([
      supabase
        .from("bar_taps")
        .select("*, menu_item:bar_menu_items(id, name, category, price)")
        .order("created_at", { ascending: true }),
      supabase
        .from("bar_menu_items")
        .select("id, name, category, price")
        .order("name", { ascending: true }),
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

  const handleAssign = async (tap: BarTap, value: string) => {
    const menu_item_id = value === NONE_VALUE ? null : value
    setSavingTapId(tap.id)

    // Optimistic update
    setTaps((prev) =>
      prev.map((t) =>
        t.id === tap.id
          ? {
              ...t,
              menu_item_id,
              menu_item: menu_item_id ? menuItems.find((m) => m.id === menu_item_id) || null : null,
            }
          : t,
      ),
    )

    const { error: updateError } = await supabase
      .from("bar_taps")
      .update({ menu_item_id })
      .eq("id", tap.id)

    if (updateError) {
      console.error("Failed to assign menu item:", updateError)
      alert("Failed to assign menu item.")
      fetchData()
    }
    setSavingTapId(null)
  }

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Beer className="h-6 w-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bar Taps</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/admin/bar">
              <Button variant="outline" size="sm" className="gap-1">
                <Settings className="h-4 w-4" />
                Manage Taps
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

        <p className="text-sm text-muted-foreground mb-6">
          Assign a bar menu item to each tap. Changes save automatically.
        </p>

        {/* Taps Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading taps...</div>
        ) : taps.length === 0 ? (
          <div className="bg-card border border-border rounded-lg text-center py-12 text-muted-foreground">
            No taps yet.{" "}
            <Link href="/admin/bar" className="text-primary underline">
              Create taps
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {taps.map((tap) => (
              <div key={tap.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Beer className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{tap.name}</h3>
                  {savingTapId === tap.id && (
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin ml-auto" />
                  )}
                </div>

                <div className="rounded-md bg-muted/50 px-3 py-2 min-h-14 flex items-center">
                  {tap.menu_item ? (
                    <div>
                      <div className="font-medium text-foreground">{tap.menu_item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {tap.menu_item.category || "Uncategorised"}
                        {tap.menu_item.price != null && ` · A$${tap.menu_item.price.toFixed(2)}`}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Empty tap</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Assign item</Label>
                  <Select
                    value={tap.menu_item_id || NONE_VALUE}
                    onValueChange={(value) => handleAssign(tap, value)}
                  >
                    <SelectTrigger>
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
              </div>
            ))}
          </div>
        )}

        {menuItems.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground mt-6">
            No bar menu items yet.{" "}
            <Link href="/admin/bar-menu" className="text-primary underline">
              Add some
            </Link>{" "}
            to assign them to taps.
          </p>
        )}
      </div>
    </div>
  )
}
