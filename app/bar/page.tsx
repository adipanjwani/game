"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Home, Beer, Plus, Minus, Trash2, RefreshCw, ShoppingCart, Banknote, CreditCard, Check } from "lucide-react"

interface BarMenuItem {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
}

interface CartLine {
  id: string
  name: string
  price: number
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
  const [isLoading, setIsLoading] = useState(true)
  const [cart, setCart] = useState<CartLine[]>([])
  const [isPaying, setIsPaying] = useState(false)
  const [lastPaid, setLastPaid] = useState<PaymentMethod | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>("All")

  const supabase = createClient()

  const fetchMenu = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("bar_menu_items")
      .select("id, name, description, price, category")
      .order("category", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      console.error("Failed to fetch bar menu:", error)
    } else {
      setMenuItems((data as BarMenuItem[]) || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchMenu()
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

  const addToCart = (item: BarMenuItem) => {
    setLastPaid(null)
    setCart((prev) => {
      const existing = prev.find((line) => line.id === item.id)
      if (existing) {
        return prev.map((line) =>
          line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }
      return [...prev, { id: item.id, name: item.name, price: item.price ?? 0, quantity: 1 }]
    })
  }

  const changeQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => (line.id === id ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    )
  }

  const removeLine = (id: string) => {
    setCart((prev) => prev.filter((line) => line.id !== id))
  }

  const clearCart = () => setCart([])

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cart],
  )
  const itemCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart],
  )

  const handlePay = async (method: PaymentMethod) => {
    if (cart.length === 0 || isPaying) return
    setIsPaying(true)

    const { error } = await supabase.from("bar_sales").insert({
      total,
      payment_method: method,
      items: cart.map((line) => ({
        id: line.id,
        name: line.name,
        price: line.price,
        quantity: line.quantity,
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
    setIsPaying(false)
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
        {/* Menu */}
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
                        onClick={() => addToCart(item)}
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
                  <li key={line.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{line.name}</div>
                      <div className="text-xs text-muted-foreground">
                        A${line.price.toFixed(2)} each
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => changeQuantity(line.id, -1)}
                        aria-label={`Decrease ${line.name}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center font-medium text-foreground">{line.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => changeQuantity(line.id, 1)}
                        aria-label={`Increase ${line.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="w-16 text-right font-semibold text-foreground">
                      A${(line.price * line.quantity).toFixed(2)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => removeLine(line.id)}
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
    </div>
  )
}
