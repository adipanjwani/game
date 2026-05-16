"use client"

import { useState, useEffect } from "react"
import { pizzas, sides, Order } from "@/lib/pizza-data"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Check, X, Plus, Minus } from "lucide-react"

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

  useEffect(() => {
    const fetchOrders = async () => {
      const res = await fetch("/api/orders")
      const data = await res.json()
      const activeOrders = data.orders.filter(
        (o: Order) => o.status === "pending" || o.status === "preparing"
      )
      
      // Build a map of item IDs to order IDs from active orders
      const activeItemToOrder: Record<string, string> = {}
      activeOrders.forEach((order: Order) => {
        order.items.forEach((item) => {
          const itemId = item.pizza?.id || item.side?.id
          if (itemId) {
            activeItemToOrder[itemId] = order.id
          }
        })
      })
      
      // Update placedOrders to match active orders
      setPlacedOrders(activeItemToOrder)
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
              <div key={item.id} className="flex items-center bg-card border border-border rounded-xl p-3">
                {/* Left: Name */}
                <span className="text-base font-bold text-foreground whitespace-nowrap w-32">{item.name}</span>

                {/* Center: Quantity + Toggle */}
                <div className="flex-1 flex items-center justify-center gap-4">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0"
                      onClick={() => handleQuantityChange(item.id, -1)}
                      disabled={isOrdered}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-bold text-lg">{qty}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0"
                      onClick={() => handleQuantityChange(item.id, 1)}
                      disabled={isOrdered}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {isPizza && !('noSizeToggle' in item && item.noSizeToggle) && (
                    <div className="flex items-center gap-2 select-none">
                      <span 
                        className={`text-sm font-semibold cursor-pointer ${!isFullPizza ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: false }))}
                      >
                        Half
                      </span>
                      <Switch
                        checked={isFullPizza}
                        onCheckedChange={(checked) => setPizzaSizes((prev) => ({ ...prev, [item.id]: checked }))}
                      />
                      <span 
                        className={`text-sm font-semibold cursor-pointer ${isFullPizza ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: true }))}
                      >
                        Full
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Buttons */}
                <div className="flex gap-2 w-60">
                  {!isOrdered ? (
                    <Button
                      size="lg"
                      className="h-10 flex-1 text-base font-bold"
                      onClick={() => handleOrder(item.type, item.id)}
                    >
                      Order
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 h-10 flex-1 text-base font-bold"
                        onClick={() => handleDelivered(orderId, item.id)}
                      >
                        Delivered
                      </Button>
                      <Button
                        size="lg"
                        variant="destructive"
                        className="h-10 flex-1 text-base font-bold"
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
        <div className="flex justify-center mt-4">
          <Button
            size="lg"
            variant="destructive"
            className={`h-24 px-40 text-3xl font-bold select-none transition-all duration-150 ${
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

    </div>
  )
}
