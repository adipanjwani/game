"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { pizzas, sides, Order } from "@/lib/pizza-data"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ChefHat, Check, X, Plus, Minus } from "lucide-react"

export default function FrontPage() {
  const [pizzaSizes, setPizzaSizes] = useState<Record<string, boolean>>(
    Object.fromEntries(pizzas.map((p) => [p.id, true]))
  )
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {
      "garlic-bread": 3,
      "kransky-dog": 6,
    }
    return Object.fromEntries(
      [...pizzas, ...sides].map((item) => [item.id, defaults[item.id] || 1])
    )
  })
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [placedOrders, setPlacedOrders] = useState<Record<string, string>>({})
  const [isCallingStaff, setIsCallingStaff] = useState(false)

  useEffect(() => {
    const fetchOrders = async () => {
      const res = await fetch("/api/orders")
      const data = await res.json()
      const cooking = data.orders.filter(
        (o: Order) => o.status === "pending" || o.status === "preparing"
      )
      setActiveOrders(cooking)
      
      setPlacedOrders((prev) => {
        const activeOrderIds = new Set(cooking.map((o: Order) => o.id))
        const updated: Record<string, string> = {}
        for (const [itemId, orderId] of Object.entries(prev)) {
          if (activeOrderIds.has(orderId)) {
            updated[itemId] = orderId
          }
        }
        return updated
      })
    }
    fetchOrders()
    const interval = setInterval(fetchOrders, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleToggleSize = (pizzaId: string) => {
    setPizzaSizes((prev) => ({ ...prev, [pizzaId]: !prev[pizzaId] }))
  }

  const handleQuantityChange = (itemId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(1, (prev[itemId] || 1) + delta),
    }))
  }

  const handleOrder = async (type: "pizza" | "side", id: string) => {
    const item = type === "pizza" 
      ? pizzas.find((p) => p.id === id)
      : sides.find((s) => s.id === id)
    
    if (!item) return

    const orderItems = [{
      ...(type === "pizza" ? { pizza: item } : { side: item }),
      isFullPizza: type === "pizza" ? pizzaSizes[id] : false,
      quantity: quantities[id] || 1,
    }]

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: orderItems }),
    })
    
    const data = await res.json()
    if (data.order) {
      setPlacedOrders((prev) => ({ ...prev, [id]: data.order.id }))
    }
  }

  const handleDelivered = async (orderId: string, itemId: string) => {
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status: "completed" }),
    })
    setPlacedOrders((prev) => {
      const updated = { ...prev }
      delete updated[itemId]
      return updated
    })
  }

  const handleCancel = async (orderId: string, itemId: string) => {
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status: "completed" }),
    })
    setPlacedOrders((prev) => {
      const updated = { ...prev }
      delete updated[itemId]
      return updated
    })
  }

  const handleSirenStart = async () => {
    setIsCallingStaff(true)
    await fetch("/api/siren", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    })
  }

  const handleSirenStop = async () => {
    setIsCallingStaff(false)
    await fetch("/api/siren", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
  }

  const allItems = [
    ...pizzas.map((p) => ({ ...p, type: "pizza" as const })),
    ...sides.map((s) => ({ ...s, type: "side" as const })),
  ]

  return (
    <div className="h-screen bg-background p-4 flex gap-4 overflow-hidden">
      {/* Menu Panel */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="flex items-center justify-between mb-3 shrink-0">
          <h1 className="text-2xl font-bold text-foreground">Menu</h1>
          <Link href="/kitchen">
            <Button variant="outline" size="default" className="gap-2">
              <ChefHat className="h-5 w-5" />
              Kitchen
            </Button>
          </Link>
        </header>

        <div className="flex-1 grid grid-cols-2 gap-2 auto-rows-fr overflow-hidden">
          {allItems.map((item) => {
            const isPizza = item.type === "pizza"
            const isFullPizza = isPizza ? pizzaSizes[item.id] : false
            const orderId = placedOrders[item.id]
            const isOrdered = !!orderId
            const qty = quantities[item.id] || 1
            
            return (
              <div key={item.id} className="flex items-center bg-card border border-border rounded-lg px-4 py-3 min-h-0">
                {/* Left: Name */}
                <span className="text-base font-bold text-foreground whitespace-nowrap w-28 shrink-0">{item.name}</span>

                {/* Center: Quantity + Toggle */}
                <div className="flex-1 flex items-center justify-center gap-4">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-12 w-12 p-0 touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleQuantityChange(item.id, -1)}
                      disabled={isOrdered}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <span className="w-8 text-center font-bold text-lg">{qty}</span>
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-12 w-12 p-0 touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleQuantityChange(item.id, 1)}
                      disabled={isOrdered}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  {isPizza && !('noSizeToggle' in item && item.noSizeToggle) && (
                    <div className="flex items-center gap-1 select-none">
                      <span 
                        className={`text-xs font-semibold cursor-pointer px-1 ${!isFullPizza ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: false }))}
                      >
                        Half
                      </span>
                      <Switch
                        checked={isFullPizza}
                        onCheckedChange={(checked) => setPizzaSizes((prev) => ({ ...prev, [item.id]: checked }))}
                      />
                      <span 
                        className={`text-xs font-semibold cursor-pointer px-1 ${isFullPizza ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: true }))}
                      >
                        Full
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Buttons */}
                <div className="flex gap-2 w-52 shrink-0">
                  {!isOrdered ? (
                    <Button
                      size="lg"
                      className="h-12 flex-1 text-base font-bold touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleOrder(item.type, item.id)}
                    >
                      Order
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 active:bg-green-800 h-12 flex-1 text-sm font-bold touch-manipulation active:scale-95 transition-transform"
                        onClick={() => handleDelivered(orderId, item.id)}
                      >
                        Delivered
                      </Button>
                      <Button
                        size="lg"
                        variant="destructive"
                        className="h-12 flex-1 text-sm font-bold touch-manipulation active:scale-95 transition-transform"
                        onClick={() => handleCancel(orderId, item.id)}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Call Staff Button - Hold to activate siren */}
        <div className="flex justify-center mt-2 shrink-0">
          <Button
            size="lg"
            variant="destructive"
            className={`h-14 px-16 text-xl font-bold select-none transition-all duration-150 ${
              isCallingStaff 
                ? "bg-red-800 scale-95 ring-4 ring-red-400 animate-pulse" 
                : "bg-red-600 hover:bg-red-700"
            }`}
            onMouseDown={handleSirenStart}
            onMouseUp={handleSirenStop}
            onMouseLeave={handleSirenStop}
            onTouchStart={handleSirenStart}
            onTouchEnd={handleSirenStop}
          >
            {isCallingStaff ? "Calling Staff..." : "Hold to Call Staff"}
          </Button>
        </div>
      </div>

      {/* Cooking Panel */}
      <div className="w-64 bg-card border border-border rounded-lg p-3 flex flex-col min-h-0 overflow-hidden shrink-0">
        <h2 className="text-base font-bold text-foreground mb-2 flex items-center gap-2 shrink-0">
          <ChefHat className="h-5 w-5 text-primary" />
          Now Cooking
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {activeOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No orders cooking
            </p>
          ) : (
            activeOrders.map((order) => (
              <div
                key={order.id}
                className="bg-muted/50 rounded-md p-2 border border-border"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    #{order.id.slice(-4)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      order.status === "preparing"
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {order.status === "preparing" ? "Cooking" : "Queued"}
                  </span>
                </div>
                {order.items.map((item, idx) => (
                  <div key={idx} className="text-sm font-semibold text-foreground">
                    {item.pizza ? (
                      <span>
                        {item.quantity > 1 && `${item.quantity}x `}{item.pizza.name} ({item.isFullPizza ? "Full" : "Half"})
                      </span>
                    ) : item.side ? (
                      <span>{item.quantity > 1 && `${item.quantity}x `}{item.side.name}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
