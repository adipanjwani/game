"use client"

import { useState, useEffect } from "react"
import { pizzas, sides, Order } from "@/lib/pizza-data"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Plus, Minus } from "lucide-react"

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
  const [placedOrders, setPlacedOrders] = useState<Record<string, string>>({})
  const [isCallingStaff, setIsCallingStaff] = useState(false)

  // Fast polling for real-time sync
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders")
      if (!res.ok) return
      const data = await res.json()
      const activeOrders = (data.orders || []).filter(
        (o: Order) => o.status === "pending" || o.status === "preparing"
      )
      
      const activeItemToOrder: Record<string, string> = {}
      activeOrders.forEach((order: Order) => {
        order.items.forEach((item) => {
          const itemId = item.pizza?.id || item.side?.id
          if (itemId) {
            activeItemToOrder[itemId] = order.id
          }
        })
      })
      
      setPlacedOrders(activeItemToOrder)
    } catch {
      // Ignore errors for fast recovery
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 1000) // Faster sync
    return () => clearInterval(interval)
  }, [fetchOrders])

  const handleToggleSize = (pizzaId: string) => {
    setPizzaSizes((prev) => ({ ...prev, [pizzaId]: !prev[pizzaId] }))
  }

  const handleQuantityChange = (itemId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(1, (prev[itemId] || 1) + delta),
    }))
  }

  const handleOrder = (type: "pizza" | "side", id: string) => {
    // Prevent double-clicks - check if already ordered
    if (placedOrders[id]) return
    
    const item = type === "pizza" 
      ? pizzas.find((p) => p.id === id)
      : sides.find((s) => s.id === id)
    
    if (!item) return

    // Optimistic UI update - show as ordered immediately
    setPlacedOrders((prev) => ({ ...prev, [id]: "pending" }))

    const orderItems = [{
      ...(type === "pizza" ? { pizza: item } : { side: item }),
      isFullPizza: type === "pizza" ? pizzaSizes[id] : false,
      quantity: quantities[id] || 1,
    }]

    // Fire and forget - don't block UI
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: orderItems }),
    }).then(res => res.json()).then(data => {
      if (data.order) {
        setPlacedOrders((prev) => ({ ...prev, [id]: data.order.id }))
      }
    }).catch(() => {
      // Revert on error
      setPlacedOrders((prev) => {
        const updated = { ...prev }
        delete updated[id]
        return updated
      })
    })
  }

  const handleDelivered = (orderId: string, itemId: string) => {
    // Optimistic UI - remove immediately
    setPlacedOrders((prev) => {
      const updated = { ...prev }
      delete updated[itemId]
      return updated
    })
    // Fire and forget
    fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status: "completed" }),
    })
  }

  const handleCancel = (orderId: string, itemId: string) => {
    // Optimistic UI - remove immediately
    setPlacedOrders((prev) => {
      const updated = { ...prev }
      delete updated[itemId]
      return updated
    })
    // Fire and forget
    fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status: "completed" }),
    })
  }

  const handleSirenStart = () => {
    setIsCallingStaff(true)
    fetch("/api/siren", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    })
  }

  const handleSirenStop = () => {
    setIsCallingStaff(false)
    fetch("/api/siren", {
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
    <div className="h-screen bg-background p-6">
      {/* Menu Panel */}
      <div className="flex-1 flex flex-col min-h-0">
        <header className="mb-4">
          <h1 className="text-3xl font-bold text-foreground">Menu</h1>
        </header>

        <div className="grid grid-cols-2 gap-4 content-start overflow-y-auto">
          {allItems.map((item) => {
            const isPizza = item.type === "pizza"
            const isFullPizza = isPizza ? pizzaSizes[item.id] : false
            const orderId = placedOrders[item.id]
            const isOrdered = !!orderId
            const qty = quantities[item.id] || 1
            
            return (
              <div key={item.id} className="flex items-center bg-card border-2 border-border rounded-xl p-4 min-h-[72px] touch-manipulation">
                {/* Left: Name */}
                <span className="text-xl font-bold text-foreground whitespace-nowrap w-40">{item.name}</span>

                {/* Center: Quantity + Toggle */}
                <div className="flex-1 flex items-center justify-center gap-6">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-14 w-14 p-0 text-2xl touch-manipulation"
                      onClick={() => handleQuantityChange(item.id, -1)}
                      disabled={isOrdered}
                    >
                      <Minus className="h-6 w-6" />
                    </Button>
                    <span className="w-12 text-center font-bold text-2xl">{qty}</span>
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-14 w-14 p-0 text-2xl touch-manipulation"
                      onClick={() => handleQuantityChange(item.id, 1)}
                      disabled={isOrdered}
                    >
                      <Plus className="h-6 w-6" />
                    </Button>
                  </div>
                  
                  {isPizza && !('noSizeToggle' in item && item.noSizeToggle) && (
                    <div className="flex items-center gap-3 select-none">
                      <span 
                        className={`text-lg font-bold cursor-pointer px-3 py-2 rounded-lg touch-manipulation ${!isFullPizza ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: false }))}
                      >
                        Half
                      </span>
                      <Switch
                        checked={isFullPizza}
                        onCheckedChange={(checked) => setPizzaSizes((prev) => ({ ...prev, [item.id]: checked }))}
                        className="scale-150"
                      />
                      <span 
                        className={`text-lg font-bold cursor-pointer px-3 py-2 rounded-lg touch-manipulation ${isFullPizza ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: true }))}
                      >
                        Full
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Buttons */}
                <div className="flex gap-3 w-72">
                  {!isOrdered ? (
                    <Button
                      size="lg"
                      className="h-14 flex-1 text-xl font-bold touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleOrder(item.type, item.id)}
                    >
                      Order
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 active:bg-green-800 h-14 flex-1 text-lg font-bold touch-manipulation active:scale-95 transition-transform"
                        onClick={() => handleDelivered(orderId, item.id)}
                      >
                        Delivered
                      </Button>
                      <Button
                        size="lg"
                        variant="destructive"
                        className="h-14 flex-1 text-lg font-bold touch-manipulation active:scale-95 transition-transform"
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
        <div className="flex justify-center mt-6">
          <Button
            size="lg"
            variant="destructive"
            className={`h-20 px-24 text-2xl font-bold select-none touch-manipulation transition-all duration-100 ${
              isCallingStaff 
                ? "bg-red-800 scale-95 ring-4 ring-red-400 animate-pulse" 
                : "bg-red-600 hover:bg-red-700 active:bg-red-800"
            }`}
            onMouseDown={handleSirenStart}
            onMouseUp={handleSirenStop}
            onMouseLeave={handleSirenStop}
            onTouchStart={handleSirenStart}
            onTouchEnd={handleSirenStop}
          >
            {isCallingStaff ? "CALLING STAFF..." : "HOLD TO CALL STAFF"}
          </Button>
        </div>
      </div>

    </div>
  )
}
