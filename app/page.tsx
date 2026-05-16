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
  const [orderTimes, setOrderTimes] = useState<Record<string, number>>({}) // Track when each item was ordered
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [isCallingStaff, setIsCallingStaff] = useState(false)
  
  const DELIVERY_TIME_LIMIT = 7.5 * 60 * 1000 // 7.5 minutes in milliseconds
  
  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])
  
  // Get time remaining for delivery
  const getTimeRemaining = (orderTime: number) => {
    const elapsed = currentTime - orderTime
    const remaining = DELIVERY_TIME_LIMIT - elapsed
    const absRemaining = Math.abs(remaining)
    const minutes = Math.floor(absRemaining / 60000)
    const seconds = Math.floor((absRemaining % 60000) / 1000)
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`
    return remaining < 0 ? `-${timeStr}` : timeStr
  }
  
  const isOverdue = (orderTime: number) => {
    return currentTime - orderTime > DELIVERY_TIME_LIMIT
  }

  // Process state update from centralized store
  const processStateUpdate = (serverOrders: Order[]) => {
    const cooking = serverOrders.filter(
      (o: Order) => o.status === "pending" || o.status === "preparing"
    )
    
    setActiveOrders(cooking)
    
    // Update placedOrders from server state
    const newPlacedOrders: Record<string, string> = {}
    cooking.forEach((order: Order) => {
      order.items.forEach((item) => {
        const itemId = item.pizza?.id || item.side?.id
        if (itemId) {
          newPlacedOrders[itemId] = order.id
        }
      })
    })
    setPlacedOrders(newPlacedOrders)
    
    // Update orderTimes from server state (use server createdAt)
    setOrderTimes((prev) => {
      const newOrderTimes: Record<string, number> = {}
      cooking.forEach((order: Order) => {
        order.items.forEach((item) => {
          const itemId = item.pizza?.id || item.side?.id
          if (itemId) {
            // Use server time for consistency across devices
            newOrderTimes[itemId] = new Date(order.createdAt).getTime()
          }
        })
      })
      return newOrderTimes
    })
  }

  // SSE for real-time state updates from centralized store
  useEffect(() => {
    const eventSource = new EventSource("/api/orders/stream")
    let lastOrdersJson = ""
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      // Ignore heartbeats - they just keep connection alive
      if (data.type === "heartbeat") {
        return
      }
      
      if (data.type === "state_update" && data.state) {
        // Only process if orders actually changed
        const newOrdersJson = JSON.stringify(data.state.orders)
        if (newOrdersJson !== lastOrdersJson) {
          lastOrdersJson = newOrdersJson
          processStateUpdate(data.state.orders)
        }
      }
    }
    
    eventSource.onerror = () => {
      // EventSource handles reconnection automatically
    }
    
    return () => {
      eventSource.close()
    }
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

    // Optimistic update
    setPlacedOrders((prev) => ({ ...prev, [id]: "pending" }))
    setOrderTimes((prev) => ({ ...prev, [id]: Date.now() }))

    const orderItems = [{
      ...(type === "pizza" ? { pizza: item } : { side: item }),
      isFullPizza: type === "pizza" ? pizzaSizes[id] : false,
      quantity: quantities[id] || 1,
    }]

    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: orderItems }),
    })
    // SSE will sync the actual order ID
  }

  const handleDelivered = async (orderId: string, itemId: string) => {
    // Optimistic update
    setPlacedOrders((prev) => {
      const updated = { ...prev }
      delete updated[itemId]
      return updated
    })
    setOrderTimes((prev) => {
      const updated = { ...prev }
      delete updated[itemId]
      return updated
    })
    
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status: "completed" }),
    })
    // SSE will confirm the update
  }

  const handleCancel = async (orderId: string, itemId: string) => {
    // Optimistic update
    setPlacedOrders((prev) => {
      const updated = { ...prev }
      delete updated[itemId]
      return updated
    })
    setOrderTimes((prev) => {
      const updated = { ...prev }
      delete updated[itemId]
      return updated
    })
    
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status: "completed" }),
    })
    // SSE will confirm the update
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
    <div className="h-dvh bg-background p-2 flex flex-col gap-1 overflow-hidden">
      {/* Menu Panel */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="flex items-center justify-between mb-1 shrink-0">
          <h1 className="text-lg font-bold text-foreground">Menu</h1>
          <Link href="/kitchen">
            <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
              <ChefHat className="h-3.5 w-3.5" />
              Kitchen
            </Button>
          </Link>
        </header>

        <div className="flex-1 grid grid-cols-2 gap-1 content-start overflow-y-auto overflow-x-hidden">
          {allItems.map((item) => {
            const isPizza = item.type === "pizza"
            const isFullPizza = isPizza ? pizzaSizes[item.id] : false
            const orderId = placedOrders[item.id]
            const isOrdered = !!orderId
            const qty = quantities[item.id] || 1
            
            return (
              <div key={item.id} className="flex items-center bg-card border border-border rounded px-2 py-1 h-[52px]">
                {/* Left: Name */}
                <span className="text-sm font-bold text-foreground whitespace-nowrap w-24 shrink-0">{item.name}</span>

                {/* Center: Quantity + Toggle */}
                <div className="flex-1 flex items-center justify-center gap-3">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleQuantityChange(item.id, -1)}
                      disabled={isOrdered}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center font-bold text-sm">{qty}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleQuantityChange(item.id, 1)}
                      disabled={isOrdered}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  
                  {isPizza && !('noSizeToggle' in item && item.noSizeToggle) && (
                    <div className="flex items-center gap-0.5 select-none">
                      <span 
                        className={`text-xs font-semibold cursor-pointer px-0.5 ${!isFullPizza ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: false }))}
                      >
                        Half
                      </span>
                      <Switch
                        checked={isFullPizza}
                        onCheckedChange={(checked) => setPizzaSizes((prev) => ({ ...prev, [item.id]: checked }))}
                        className="scale-90"
                      />
                      <span 
                        className={`text-xs font-semibold cursor-pointer px-0.5 ${isFullPizza ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: true }))}
                      >
                        Full
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Timer + Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isOrdered && orderTimes[item.id] && (
                    <span className={`text-sm font-mono font-bold w-12 text-right ${
                      isOverdue(orderTimes[item.id]) ? "text-red-500" : "text-primary"
                    }`}>
                      {getTimeRemaining(orderTimes[item.id])}
                    </span>
                  )}
                  <div className="flex gap-1 w-36">
                    {!isOrdered ? (
                      <Button
                        size="sm"
                        className="h-8 flex-1 text-sm font-bold touch-manipulation active:scale-95 transition-transform"
                        onClick={() => handleOrder(item.type, item.id)}
                      >
                        Order
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 active:bg-green-800 h-8 flex-1 text-xs font-bold touch-manipulation active:scale-95 transition-transform"
                          onClick={() => handleDelivered(orderId, item.id)}
                        >
                          Delivered
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 flex-1 text-xs font-bold touch-manipulation active:scale-95 transition-transform"
                          onClick={() => handleCancel(orderId, item.id)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Call Staff Button - Hold to activate siren */}
        <div className="flex justify-center mt-1 shrink-0">
          <Button
            size="lg"
            variant="destructive"
            className={`h-10 px-10 text-base font-bold select-none transition-all duration-150 ${
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
