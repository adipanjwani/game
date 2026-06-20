"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Home, Beer, Plus, Minus, Trash2, RefreshCw, ShoppingCart, Banknote, CreditCard, Check, X, Wallet, ChevronDown, Receipt } from "lucide-react"

interface BarMenuItem {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
}

interface TapBillLine {
  name: string
  addons: string[]
  unitPrice: number
  quantity: number
}

interface BarTap {
  id: string
  name: string
  tap_limit: number | null
  consumed: number
  bill: TapBillLine[]
}

interface SaleItem {
  name?: string
  price?: number
  quantity?: number
  addons?: { name?: string; quantity?: number }[]
}

interface BarAddon {
  id: string
  name: string
  price: number
}

interface CartAddon {
  id: string
  name: string
  price: number
  quantity: number
}

interface CartLine {
  lineKey: string
  itemId: string
  name: string
  basePrice: number
  addons: CartAddon[]
  unitPrice: number
  quantity: number
}

type PaymentMethod = "cash" | "card" | "bar_tap"

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "cash",
  card: "card",
  bar_tap: "bar tap",
}

export default function BarPosPage() {
  const [menuItems, setMenuItems] = useState<BarMenuItem[]>([])
  const [taps, setTaps] = useState<BarTap[]>([])
  const [addons, setAddons] = useState<BarAddon[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cart, setCart] = useState<CartLine[]>([])
  const [isPaying, setIsPaying] = useState(false)
  const [lastPaid, setLastPaid] = useState<PaymentMethod | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [showTapPicker, setShowTapPicker] = useState(false)
  const [showBalances, setShowBalances] = useState(false)
  const [expandedTapId, setExpandedTapId] = useState<string | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({})

  const supabase = createClient()

  const fetchMenu = async () => {
    setIsLoading(true)
    const [menuRes, addonsRes] = await Promise.all([
      supabase
        .from("bar_menu_items")
        .select("id, name, description, price, category")
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("bar_addons").select("id, name, price").order("name", { ascending: true }),
    ])

    if (menuRes.error) {
      console.error("Failed to fetch bar menu:", menuRes.error)
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

  const fetchTaps = async () => {
    const [tapsRes, salesRes] = await Promise.all([
      supabase.from("bar_taps").select("id, name, tap_limit").order("name", { ascending: true }),
      supabase.from("bar_sales").select("bar_tap_id, total, items").eq("payment_method", "bar_tap"),
    ])

    if (tapsRes.error) {
      console.error("Failed to fetch bar taps:", tapsRes.error)
      return
    }
    if (salesRes.error) {
      console.error("Failed to fetch tap sales:", salesRes.error)
    }

    const consumedByTap = new Map<string, number>()
    // Aggregate identical lines (same name + add-ons + price) per tap
    const billByTap = new Map<string, Map<string, TapBillLine>>()

    ;(salesRes.data || []).forEach(
      (sale: { bar_tap_id: string | null; total: number | null; items: SaleItem[] | null }) => {
        if (!sale.bar_tap_id) return
        consumedByTap.set(sale.bar_tap_id, (consumedByTap.get(sale.bar_tap_id) || 0) + (sale.total || 0))

        if (!billByTap.has(sale.bar_tap_id)) billByTap.set(sale.bar_tap_id, new Map())
        const lines = billByTap.get(sale.bar_tap_id)!
        ;(sale.items || []).forEach((item) => {
          const addonNames = (item.addons || [])
            .map((a) => {
              const n = a?.name || ""
              if (!n) return ""
              const q = a?.quantity ?? 1
              return q > 1 ? `${n} ×${q}` : n
            })
            .filter(Boolean)
          const unitPrice = item.price ?? 0
          const qty = item.quantity ?? 1
          const key = `${item.name || "Item"}|${addonNames.join(",")}|${unitPrice}`
          const existing = lines.get(key)
          if (existing) {
            existing.quantity += qty
          } else {
            lines.set(key, {
              name: item.name || "Item",
              addons: addonNames,
              unitPrice,
              quantity: qty,
            })
          }
        })
      },
    )

    const tapsWithBalance: BarTap[] = (tapsRes.data || []).map(
      (tap: { id: string; name: string; tap_limit: number | null }) => ({
        id: tap.id,
        name: tap.name,
        tap_limit: tap.tap_limit,
        consumed: consumedByTap.get(tap.id) || 0,
        bill: Array.from(billByTap.get(tap.id)?.values() || []),
      }),
    )

    setTaps(tapsWithBalance)
  }

  useEffect(() => {
    fetchMenu()
    fetchTaps()
  }, [])

  const groupedMenu = useMemo(() => {
    const groups = new Map<string, BarMenuItem[]>()
    menuItems.forEach((item) => {
      const key = item.category?.trim() || "Other"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    })
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [menuItems])

  const categories = useMemo(() => ["All", ...groupedMenu.map(([category]) => category)], [groupedMenu])

  const visibleMenu = useMemo(
    () => (activeCategory === "All" ? groupedMenu : groupedMenu.filter(([category]) => category === activeCategory)),
    [groupedMenu, activeCategory],
  )

  const addLineToCart = (item: BarMenuItem, lineAddons: CartAddon[]) => {
    setLastPaid(null)
    const basePrice = item.price ?? 0
    const addonsTotal = lineAddons.reduce((sum, a) => sum + a.price * a.quantity, 0)
    const unitPrice = basePrice + addonsTotal
    const sortedKeys = lineAddons
      .map((a) => `${a.id}x${a.quantity}`)
      .sort()
    const lineKey = [item.id, ...sortedKeys].join("|")

    setCart((prev) => {
      const existing = prev.find((line) => line.lineKey === lineKey)
      if (existing) {
        return prev.map((line) =>
          line.lineKey === lineKey ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }
      return [
        ...prev,
        {
          lineKey,
          itemId: item.id,
          name: item.name,
          basePrice,
          addons: lineAddons,
          unitPrice,
          quantity: 1,
        },
      ]
    })
  }

  const onItemClick = (item: BarMenuItem) => {
    const chosen: CartAddon[] = addons
      .filter((a) => (selectedAddons[a.id] ?? 0) > 0)
      .map((a) => ({ id: a.id, name: a.name, price: a.price, quantity: selectedAddons[a.id] }))
    addLineToCart(item, chosen)
    // Clear the add-on selection after each item so it doesn't carry over to the next drink
    setSelectedAddons({})
  }

  const changeAddonQty = (id: string, delta: number) => {
    setSelectedAddons((prev) => {
      const next = { ...prev }
      const current = next[id] ?? 0
      const updated = current + delta
      if (updated <= 0) {
        delete next[id]
      } else {
        next[id] = updated
      }
      return next
    })
  }

  const changeQuantity = (lineKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => (line.lineKey === lineKey ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    )
  }

  const removeLine = (lineKey: string) => {
    setCart((prev) => prev.filter((line) => line.lineKey !== lineKey))
  }

  const clearCart = () => setCart([])

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cart],
  )
  const itemCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart],
  )

  const handlePay = async (method: PaymentMethod, tap?: BarTap) => {
    if (cart.length === 0 || isPaying) return

    // Bar tap payments must be charged to a specific tap
    if (method === "bar_tap" && !tap) {
      setShowTapPicker(true)
      return
    }

    setIsPaying(true)

    const { error } = await supabase.from("bar_sales").insert({
      total,
      payment_method: method,
      bar_tap_id: tap?.id ?? null,
      bar_tap_name: tap?.name ?? null,
      items: cart.map((line) => ({
        id: line.itemId,
        name: line.name,
        base_price: line.basePrice,
        price: line.unitPrice,
        quantity: line.quantity,
        addons: line.addons.map((a) => ({ id: a.id, name: a.name, price: a.price, quantity: a.quantity })),
      })),
    })

    if (error) {
      console.error("Failed to record sale:", error)
      alert("Failed to process payment. Please try again.")
      setIsPaying(false)
      return
    }

    setCart([])
    setLastPaid(method)
    setShowTapPicker(false)
    setIsPaying(false)

    // Refresh tap balances so consumed/remaining reflect this sale
    if (method === "bar_tap") {
      fetchTaps()
    }
  }

  return (
    <div className="h-dvh bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Beer className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Bar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              fetchTaps()
              setShowBalances(true)
            }}
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Check Balance</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={fetchMenu}>
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Front</span>
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Menu column */}
        <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading menu...</div>
          ) : menuItems.length === 0 ? (
            <div className="bg-card border border-border rounded-lg text-center py-12 text-muted-foreground">
              No bar menu items yet.{" "}
              <Link href="/admin/bar" className="text-primary underline">
                Add some
              </Link>{" "}
              to start selling.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {categories.length > 1 && (
                <div className="flex flex-wrap gap-2 sticky top-0 bg-background pb-1 z-10">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors touch-manipulation ${
                        activeCategory === category
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:border-primary"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
              {visibleMenu.map(([category, items]) => (
                <section key={category}>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {category}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onItemClick(item)}
                        className="bg-card border border-border rounded-lg p-3 text-left flex flex-col gap-1 hover:border-primary hover:bg-accent transition-colors touch-manipulation active:scale-95"
                      >
                        <span className="font-medium text-foreground leading-tight">{item.name}</span>
                        <span className="text-sm font-semibold text-primary mt-auto">
                          {item.price != null ? `A$${item.price.toFixed(2)}` : "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Add-on selector — choose extras (with quantities), then tap a drink to apply them */}
        {addons.length > 0 && (
          <div className="border-t border-border bg-card px-4 py-3 shrink-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Add-ons {Object.keys(selectedAddons).length > 0 && `· applied to next drink`}
              </span>
              {Object.keys(selectedAddons).length > 0 && (
                <button
                  onClick={() => setSelectedAddons({})}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground touch-manipulation"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {addons.map((addon) => {
                const qty = selectedAddons[addon.id] ?? 0
                const active = qty > 0
                return (
                  <div
                    key={addon.id}
                    className={`flex items-center gap-1 rounded-full border pl-3 pr-1 py-1 text-sm font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-muted/40 text-foreground"
                    }`}
                  >
                    {!active ? (
                      <button
                        onClick={() => changeAddonQty(addon.id, 1)}
                        className="flex items-center gap-1.5 touch-manipulation py-0.5 pr-1"
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        {addon.name}
                        <span className="text-primary">+A${addon.price.toFixed(2)}</span>
                      </button>
                    ) : (
                      <>
                        <span className="mr-1">
                          {addon.name}
                          <span className="text-primary"> +A${addon.price.toFixed(2)}</span>
                        </span>
                        <button
                          onClick={() => changeAddonQty(addon.id, -1)}
                          className="h-6 w-6 rounded-full flex items-center justify-center bg-card border border-border touch-manipulation"
                          aria-label={`Decrease ${addon.name}`}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center font-semibold">{qty}</span>
                        <button
                          onClick={() => changeAddonQty(addon.id, 1)}
                          className="h-6 w-6 rounded-full flex items-center justify-center bg-primary text-primary-foreground touch-manipulation"
                          aria-label={`Increase ${addon.name}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        </div>

        {/* Cart */}
        <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border bg-card flex flex-col min-h-0 shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Cart</h2>
              {itemCount > 0 && (
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-medium">
                  {itemCount}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={clearCart}>
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-12">
                {lastPaid ? (
                  <>
                    <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center">
                      <Check className="h-6 w-6 text-primary" />
                    </div>
                    <p className="font-medium text-foreground">Payment complete</p>
                    <p className="text-sm">Paid by {PAYMENT_LABELS[lastPaid]}.</p>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-8 w-8 opacity-50" />
                    <p className="text-sm">Tap a drink to add it to the cart.</p>
                  </>
                )}
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {cart.map((line) => (
                  <li key={line.lineKey} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{line.name}</div>
                      {line.addons.length > 0 && (
                        <div className="text-xs text-muted-foreground truncate">
                          {line.addons.map((a) => `+ ${a.name}${a.quantity > 1 ? ` ×${a.quantity}` : ""}`).join(", ")}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        A${line.unitPrice.toFixed(2)} each
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => changeQuantity(line.lineKey, -1)}
                        aria-label={`Decrease ${line.name}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center font-medium text-foreground">{line.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => changeQuantity(line.lineKey, 1)}
                        aria-label={`Increase ${line.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="w-16 text-right font-semibold text-foreground">
                      A${(line.unitPrice * line.quantity).toFixed(2)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => removeLine(line.lineKey)}
                      aria-label={`Remove ${line.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Totals & Payment */}
          <div className="border-t border-border p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-lg">
              <span className="font-medium text-foreground">Total</span>
              <span className="font-bold text-foreground">A${total.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="lg"
                className="flex-col h-auto py-3 gap-1"
                disabled={cart.length === 0 || isPaying}
                onClick={() => handlePay("cash")}
              >
                <Banknote className="h-5 w-5" />
                Cash
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="flex-col h-auto py-3 gap-1"
                disabled={cart.length === 0 || isPaying}
                onClick={() => handlePay("card")}
              >
                <CreditCard className="h-5 w-5" />
                Card
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-col h-auto py-3 gap-1"
                disabled={cart.length === 0 || isPaying}
                onClick={() => handlePay("bar_tap")}
              >
                <Beer className="h-5 w-5" />
                Bar Tap
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Tap balances */}
      {showBalances && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowBalances(false)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Tap Balances</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowBalances(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {taps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No bar taps set up yet.{" "}
                  <Link href="/admin/bar" className="text-primary underline">
                    Create one
                  </Link>
                  .
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {taps.map((tap) => {
                    const hasLimit = tap.tap_limit != null
                    const remaining = hasLimit ? (tap.tap_limit as number) - tap.consumed : null
                    const isOver = remaining != null && remaining < 0
                    const isExpanded = expandedTapId === tap.id
                    return (
                      <li key={tap.id} className="flex flex-col gap-1.5 bg-muted/40 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{tap.name}</span>
                          {hasLimit ? (
                            <span className={isOver ? "font-semibold text-destructive" : "font-semibold text-primary"}>
                              A${(remaining as number).toFixed(2)} left
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No limit</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Consumed: A${tap.consumed.toFixed(2)}
                          {hasLimit && ` / A$${(tap.tap_limit as number).toFixed(2)}`}
                        </div>
                        {hasLimit && (
                          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isOver ? "bg-destructive" : "bg-primary"}`}
                              style={{
                                width: `${Math.min(100, (tap.consumed / (tap.tap_limit as number)) * 100)}%`,
                              }}
                            />
                          </div>
                        )}

                        {tap.bill.length > 0 ? (
                          <>
                            <button
                              onClick={() => setExpandedTapId(isExpanded ? null : tap.id)}
                              className="mt-1 flex items-center gap-1 text-xs font-medium text-primary touch-manipulation"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              {isExpanded ? "Hide bill" : "View bill"}
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                            {isExpanded && (
                              <ul className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
                                {tap.bill.map((line, idx) => (
                                  <li key={idx} className="flex items-start justify-between gap-2 text-sm">
                                    <div className="min-w-0">
                                      <span className="text-foreground">
                                        {line.quantity} × {line.name}
                                      </span>
                                      {line.addons.length > 0 && (
                                        <span className="block text-xs text-muted-foreground truncate">
                                          {line.addons.map((a) => `+ ${a}`).join(", ")}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono text-foreground whitespace-nowrap">
                                      A${(line.unitPrice * line.quantity).toFixed(2)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        ) : (
                          tap.consumed === 0 && <p className="text-xs text-muted-foreground italic">No items yet.</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bar Tap picker */}
      {showTapPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !isPaying && setShowTapPicker(false)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Beer className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Charge to which tap?</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowTapPicker(false)}
                disabled={isPaying}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {taps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No bar taps set up yet.{" "}
                  <Link href="/admin/bar" className="text-primary underline">
                    Create one
                  </Link>
                  .
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {taps.map((tap) => {
                    const hasLimit = tap.tap_limit != null
                    const remaining = hasLimit ? (tap.tap_limit as number) - tap.consumed : null
                    const wouldExceed = remaining != null && total > remaining
                    return (
                      <li key={tap.id}>
                        <button
                          onClick={() => handlePay("bar_tap", tap)}
                          disabled={isPaying || wouldExceed}
                          className="w-full flex flex-col gap-1.5 bg-muted/40 hover:bg-accent rounded-lg p-3 text-left transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-muted/40"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground">{tap.name}</span>
                            <span className="font-semibold text-primary">+A${total.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground">
                              Consumed: A${tap.consumed.toFixed(2)}
                              {hasLimit && ` / A$${(tap.tap_limit as number).toFixed(2)}`}
                            </span>
                            {hasLimit && (
                              <span className={wouldExceed ? "font-medium text-destructive" : "text-muted-foreground"}>
                                {wouldExceed ? "Over limit" : `A$${(remaining as number).toFixed(2)} left`}
                              </span>
                            )}
                          </div>
                          {hasLimit && (
                            <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                              <div
                                className={`h-full rounded-full ${wouldExceed ? "bg-destructive" : "bg-primary"}`}
                                style={{
                                  width: `${Math.min(100, ((tap.consumed + total) / (tap.tap_limit as number)) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
