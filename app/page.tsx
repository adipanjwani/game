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

  const fetchOrders = async () => {
    const res = await fetch("/api/orders")
    const data = await res.json()
    const serverOrders: Order[] = data.orders
    const cooking = serverOrders.filter(
      (o: Order) => o.status === "pending" || o.status === "preparing"
    )
    
    // Merge orders instead of replacing - add new, remove completed
    setActiveOrders((prevOrders) => {
      const prevOrderMap = new Map(prevOrders.map(o => [o.id, o]))
      const serverActiveIds = new Set(cooking.map(o => o.id))
      
      const mergedOrders: Order[] = []
      
      // Add/update orders from server
      for (const serverOrder of cooking) {
        const existingOrder = prevOrderMap.get(serverOrder.id)
        if (existingOrder && existingOrder.status === serverOrder.status) {
          // Keep existing reference to prevent re-render
          mergedOrders.push(existingOrder)
        } else {
          mergedOrders.push(serverOrder)
        }
      }
      
      return mergedOrders
    })
    
    // Update placedOrders and orderTimes incrementally
    setPlacedOrders((prev) => {
      const newPlacedOrders: Record<string, string> = {}
      cooking.forEach((order: Order) => {
        order.items.forEach((item) => {
          const itemId = item.pizza?.id || item.side?.id
          if (itemId) {
            newPlacedOrders[itemId] = order.id
          }
        })
      })
      // Only update if changed
      const prevKeys = Object.keys(prev).sort().join(',')
      const newKeys = Object.keys(newPlacedOrders).sort().join(',')
      if (prevKeys !== newKeys) {
        return newPlacedOrders
      }
      return prev
    })
    
    setOrderTimes((prev) => {
      const newOrderTimes: Record<string, number> = {}
      cooking.forEach((order: Order) => {
        order.items.forEach((item) => {
          const itemId = item.pizza?.id || item.side?.id
          if (itemId) {
            // Keep existing time if we already have it
            newOrderTimes[itemId] = prev[itemId] || new Date(order.createdAt).getTime()
          }
        })
      })
      // Only update if keys changed
      const prevKeys = Object.keys(prev).sort().join(',')
      const newKeys = Object.keys(newOrderTimes).sort().join(',')
      if (prevKeys !== newKeys) {
        return newOrderTimes
      }
      return prev
    })
  }

  // Initial fetch and SSE for real-time updates
  useEffect(() => {
    fetchOrders()
    
    // Connect to SSE for instant updates
    const eventSource = new EventSource("/api/orders/stream")
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === "orders_updated") {
        fetchOrders()
      }
    }
    
    // Fallback polling every 5s in case SSE disconnects
    const interval = setInterval(fetchOrders, 5000)
    
    return () => {
      eventSource.close()
      clearInterval(interval)
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
      setOrderTimes((prev) => ({ ...prev, [id]: Date.now() }))
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
    setOrderTimes((prev) => {
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
    setOrderTimes((prev) => {
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
    <div className="h-dvh bg-background p-2 md:p-3 lg:p-4 flex flex-col gap-2 md:gap-3 lg:gap-4 overflow-hidden">
      {/* Menu Panel */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="flex items-center justify-between mb-2 md:mb-3 shrink-0">
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-foreground">Menu</h1>
          <Link href="/kitchen">
            <Button variant="outline" size="sm" className="gap-1 md:gap-2 text-xs md:text-sm">
              <ChefHat className="h-4 w-4" />
              <span className="hidden sm:inline">Kitchen</span>
            </Button>
          </Link>
        </header>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2 auto-rows-fr overflow-y-auto overflow-x-hidden">
          {allItems.map((item) => {
            const isPizza = item.type === "pizza"
            const isFullPizza = isPizza ? pizzaSizes[item.id] : false
            const orderId = placedOrders[item.id]
            const isOrdered = !!orderId
            const qty = quantities[item.id] || 1
            
            return (
              <div key={item.id} className="flex items-center bg-card border border-border rounded-md md:rounded-lg px-2 md:px-3 lg:px-4 py-1.5 md:py-2 lg:py-3 min-h-0">
                {/* Left: Name */}
                <span className="text-xs md:text-sm lg:text-base font-bold text-foreground whitespace-nowrap w-16 md:w-20 lg:w-28 shrink-0">{item.name}</span>

                {/* Center: Quantity + Toggle */}
                <div className="flex-1 flex items-center justify-center gap-2 md:gap-3 lg:gap-4">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1 md:gap-1.5 lg:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 md:h-9 md:w-9 lg:h-12 lg:w-12 p-0 touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleQuantityChange(item.id, -1)}
                      disabled={isOrdered}
                    >
                      <Minus className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5" />
                    </Button>
                    <span className="w-5 md:w-6 lg:w-8 text-center font-bold text-sm md:text-base lg:text-lg">{qty}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 md:h-9 md:w-9 lg:h-12 lg:w-12 p-0 touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleQuantityChange(item.id, 1)}
                      disabled={isOrdered}
                    >
                      <Plus className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5" />
                    </Button>
                  </div>
                  
                  {isPizza && !('noSizeToggle' in item && item.noSizeToggle) && (
                    <div className="flex items-center gap-0.5 md:gap-1 select-none">
                      <span 
                        className={`text-[10px] md:text-xs font-semibold cursor-pointer px-0.5 md:px-1 ${!isFullPizza ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: false }))}
                      >
                        Half
                      </span>
                      <Switch
                        checked={isFullPizza}
                        onCheckedChange={(checked) => setPizzaSizes((prev) => ({ ...prev, [item.id]: checked }))}
                        className="scale-75 md:scale-90 lg:scale-100"
                      />
                      <span 
                        className={`text-[10px] md:text-xs font-semibold cursor-pointer px-0.5 md:px-1 ${isFullPizza ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: true }))}
                      >
                        Full
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Timer + Buttons */}
                <div className="flex items-center gap-1 md:gap-2 shrink-0">
                  {isOrdered && orderTimes[item.id] && (
                    <span className={`text-xs md:text-sm lg:text-base font-mono font-bold w-12 md:w-14 lg:w-16 text-right ${
                      isOverdue(orderTimes[item.id]) ? "text-red-500" : "text-primary"
                    }`}>
                      {getTimeRemaining(orderTimes[item.id])}
                    </span>
                  )}
                  <div className="flex gap-1 md:gap-1.5 lg:gap-2 w-20 md:w-32 lg:w-44">
                    {!isOrdered ? (
                      <Button
                        size="sm"
                        className="h-7 md:h-9 lg:h-12 flex-1 text-xs md:text-sm lg:text-base font-bold touch-manipulation active:scale-95 transition-transform"
                        onClick={() => handleOrder(item.type, item.id)}
                      >
                        Order
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 active:bg-green-800 h-7 md:h-9 lg:h-12 flex-1 text-[10px] md:text-xs lg:text-sm font-bold touch-manipulation active:scale-95 transition-transform"
                          onClick={() => handleDelivered(orderId, item.id)}
                        >
                          <span className="hidden md:inline">Delivered</span>
                          <Check className="h-4 w-4 md:hidden" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 md:h-9 lg:h-12 flex-1 text-[10px] md:text-xs lg:text-sm font-bold touch-manipulation active:scale-95 transition-transform"
                          onClick={() => handleCancel(orderId, item.id)}
                        >
                          <span className="hidden md:inline">Cancel</span>
                          <X className="h-4 w-4 md:hidden" />
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
        <div className="flex justify-center mt-1.5 md:mt-2 shrink-0">
          <Button
            size="lg"
            variant="destructive"
            className={`h-10 md:h-12 lg:h-14 px-6 md:px-10 lg:px-16 text-sm md:text-lg lg:text-xl font-bold select-none transition-all duration-150 ${
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
