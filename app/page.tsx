"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { pizzas, sides, Order } from "@/lib/pizza-data"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ChefHat, Check, X, Plus, Minus, ShoppingBag, Delete, Send } from "lucide-react"

interface CartItem {
  cartItemId: string // Unique ID for each cart entry
  id: string // Original item ID
  name: string
  type: "pizza" | "side"
  isFullPizza: boolean
  quantity: number
}

export default function FrontPage() {
  const [menuMode, setMenuMode] = useState<"front" | "takeaway">("front")
  const [takeawayOrderNumber, setTakeawayOrderNumber] = useState("")
  const [takeawayCart, setTakeawayCart] = useState<CartItem[]>([])
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
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set()) // Items with in-flight requests
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
    // Filter only front orders for the front display state
    const frontOrders = serverOrders.filter(
      (o: Order) => o.orderType === "front" || !o.orderType
    )
    
    const cooking = frontOrders.filter(
      (o: Order) => o.status === "pending" || o.status === "preparing"
    )
    
    setActiveOrders(cooking)
    
    // Build server-side placed orders (only from front orders)
    const serverPlacedOrders: Record<string, string> = {}
    const serverOrderTimes: Record<string, number> = {}
    cooking.forEach((order: Order) => {
      order.items.forEach((item) => {
        const itemId = item.pizza?.id || item.side?.id
        if (itemId) {
          serverPlacedOrders[itemId] = order.id
          serverOrderTimes[itemId] = new Date(order.createdAt).getTime()
        }
      })
    })
    
    // Merge with pending (in-flight) items - don't overwrite items that are still being submitted
    setPlacedOrders((prev) => {
      const merged = { ...serverPlacedOrders }
      // Keep optimistic entries for items still in-flight
      setPendingItems((currentPending) => {
        const stillPending = new Set<string>()
        currentPending.forEach((itemId) => {
          if (!serverPlacedOrders[itemId]) {
            // Server doesn't know about this yet, keep optimistic entry
            merged[itemId] = prev[itemId] || "pending"
            stillPending.add(itemId)
          }
          // If server has it, remove from pending
        })
        return stillPending
      })
      return merged
    })
    
    setOrderTimes((prev) => {
      const merged = { ...serverOrderTimes }
      // Keep optimistic times for pending items
      setPendingItems((currentPending) => {
        currentPending.forEach((itemId) => {
          if (!serverOrderTimes[itemId] && prev[itemId]) {
            merged[itemId] = prev[itemId]
          }
        })
        return currentPending
      })
      return merged
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

    // For takeaway, add to cart instead of sending immediately
    if (menuMode === "takeaway") {
      const cartItem: CartItem = {
        cartItemId: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        id: item.id,
        name: item.name,
        type,
        isFullPizza: type === "pizza" ? pizzaSizes[id] : false,
        quantity: quantities[id] || 1,
      }
      setTakeawayCart((prev) => [...prev, cartItem])
      return
    }

    // For front orders, send immediately (existing behavior)
    // Mark as pending (in-flight) so SSE updates don't overwrite
    setPendingItems((prev) => new Set(prev).add(id))
    
    // Optimistic update
    setPlacedOrders((prev) => ({ ...prev, [id]: "pending" }))
    setOrderTimes((prev) => ({ ...prev, [id]: Date.now() }))

    const orderItems = [{
      ...(type === "pizza" ? { pizza: item } : { side: item }),
      isFullPizza: type === "pizza" ? pizzaSizes[id] : false,
      quantity: quantities[id] || 1,
    }]

    const orderPayload: { 
      items: typeof orderItems
      orderType: "front" | "takeaway"
      orderNumber?: string 
    } = {
      items: orderItems,
      orderType: "front",
    }

    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      })
    } catch (error) {
      // Revert optimistic update on failure
      setPendingItems((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setPlacedOrders((prev) => {
        const updated = { ...prev }
        delete updated[id]
        return updated
      })
      setOrderTimes((prev) => {
        const updated = { ...prev }
        delete updated[id]
        return updated
      })
    }
    // SSE will sync the actual order ID and clear from pendingItems
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

  const sirenIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const handleSirenStart = () => {
    setIsCallingStaff(true)
    // Send immediately
    fetch("/api/siren", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    })
    // Keep sending every 200ms to keep siren alive (server auto-deactivates after 500ms)
    sirenIntervalRef.current = setInterval(() => {
      fetch("/api/siren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      })
    }, 200)
  }

  const handleSirenStop = () => {
    setIsCallingStaff(false)
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current)
      sirenIntervalRef.current = null
    }
    fetch("/api/siren", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
  }

  // Clean up siren interval on unmount
  useEffect(() => {
    return () => {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current)
      }
    }
  }, [])

  const handleNumpadPress = (value: string) => {
    if (value === "backspace") {
      setTakeawayOrderNumber((prev) => prev.slice(0, -1))
    } else if (value === "clear") {
      setTakeawayOrderNumber("")
    } else {
      setTakeawayOrderNumber((prev) => prev + value)
    }
  }

  const handleRemoveFromCart = (cartItemId: string) => {
    setTakeawayCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId))
  }

  const handleSendToKitchen = async () => {
    if (takeawayCart.length === 0) return
    if (!takeawayOrderNumber.trim()) return // Order number is mandatory

    // Send each cart item as a separate order to kitchen
    const orderPromises = takeawayCart.map(async (cartItem) => {
      const item = cartItem.type === "pizza"
        ? pizzas.find((p) => p.id === cartItem.id)
        : sides.find((s) => s.id === cartItem.id)
      
      const orderItems = [{
        ...(cartItem.type === "pizza" ? { pizza: item } : { side: item }),
        isFullPizza: cartItem.isFullPizza,
        quantity: cartItem.quantity,
      }]

      const orderPayload: {
        items: typeof orderItems
        orderType: "front" | "takeaway"
        orderNumber: string
      } = {
        items: orderItems,
        orderType: "takeaway",
        orderNumber: takeawayOrderNumber.trim(),
      }

      return fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      })
    })

    try {
      await Promise.all(orderPromises)
      
      // Clear cart and return to front mode
      setTakeawayCart([])
      setTakeawayOrderNumber("")
      setMenuMode("front")
    } catch (error) {
      console.error("Failed to send order to kitchen:", error)
    }
  }

  const allItems = [
    ...pizzas.map((p) => ({ ...p, type: "pizza" as const })),
    ...sides.map((s) => ({ ...s, type: "side" as const })),
  ]

  return (
    <div className="h-dvh bg-background p-2 md:p-3 flex flex-col gap-1 md:gap-2 overflow-hidden">
      {/* Menu Panel */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="flex items-center justify-between mb-1 md:mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              {menuMode === "takeaway" ? "Takeaway Order" : "Front Menu"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {menuMode === "takeaway" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 md:h-8 text-xs"
                onClick={() => {
                  setMenuMode("front")
                  setTakeawayOrderNumber("")
                  setTakeawayCart([])
                }}
              >
                Cancel
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 md:h-8 gap-1 text-xs md:text-sm"
                onClick={() => setMenuMode("takeaway")}
              >
                <ShoppingBag className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Takeaway
              </Button>
            )}
            <Link href="/kitchen">
              <Button variant="outline" size="sm" className="gap-1 text-xs md:text-sm h-7 md:h-8">
                <ChefHat className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Kitchen
              </Button>
            </Link>
          </div>
        </header>

        {/* Numeric Keypad for Takeaway Order Number */}
        {menuMode === "takeaway" && (
          <div className="flex flex-col gap-1.5 mb-1 md:mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((num) => (
                  <Button
                    key={num}
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 md:h-10 md:w-10 p-0 text-base md:text-lg font-bold touch-manipulation active:scale-95 transition-transform"
                    onClick={() => handleNumpadPress(num)}
                  >
                    {num}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 md:h-10 md:w-10 p-0 touch-manipulation active:scale-95 transition-transform"
                  onClick={() => handleNumpadPress("backspace")}
                >
                  <Delete className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2 md:h-10 md:px-3 text-xs font-bold touch-manipulation active:scale-95 transition-transform"
                  onClick={() => handleNumpadPress("clear")}
                >
                  CLR
                </Button>
              </div>
              <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-3 py-1.5">
                <span className="text-sm text-muted-foreground">Order #:</span>
                <span className="text-lg md:text-xl font-bold text-foreground min-w-[3ch]">
                  {takeawayOrderNumber || "-"}
                </span>
              </div>
            </div>
            
            {/* Cart Display */}
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
              <div className="flex-1 flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-semibold text-amber-600 shrink-0">Cart:</span>
                {takeawayCart.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Empty - tap items to add</span>
                ) : (
                  <div className="flex items-center gap-1">
                    {takeawayCart.map((cartItem) => (
                      <div
                        key={cartItem.cartItemId}
                        className="flex items-center gap-1 bg-amber-500/20 rounded px-1.5 py-0.5"
                      >
                        <span className="text-xs font-medium text-foreground whitespace-nowrap">
                          {cartItem.quantity}x {cartItem.name}
                          {cartItem.type === "pizza" && (cartItem.isFullPizza ? " (F)" : " (H)")}
                        </span>
                        <button
                          className="text-red-500 hover:text-red-700 p-0.5 touch-manipulation"
                          onClick={() => handleRemoveFromCart(cartItem.cartItemId)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-white font-bold shrink-0 disabled:bg-gray-400 disabled:cursor-not-allowed"
                onClick={handleSendToKitchen}
                disabled={takeawayCart.length === 0 || !takeawayOrderNumber.trim()}
              >
                <Send className="h-3.5 w-3.5" />
                {!takeawayOrderNumber.trim() ? "Enter Order #" : "Send to Kitchen"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1 md:gap-1.5 content-start overflow-y-auto overflow-x-hidden">
          {allItems.map((item) => {
            const isPizza = item.type === "pizza"
            const isFullPizza = isPizza ? pizzaSizes[item.id] : false
            const orderId = placedOrders[item.id]
            // Only show ordered state in front mode - takeaway uses cart system
            const isOrdered = menuMode === "front" && !!orderId
            const qty = quantities[item.id] || 1
            
            return (
              <div key={item.id} className="flex items-center bg-card border border-border rounded px-2 md:px-3 py-1 md:py-1.5 h-[48px] md:h-[56px]">
                {/* Left: Name */}
                <span className="text-xs sm:text-sm font-bold text-foreground whitespace-nowrap w-20 sm:w-24 shrink-0">{item.name}</span>

                {/* Center: Quantity + Toggle */}
                <div className="flex-1 flex items-center justify-center gap-2 sm:gap-3">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 sm:h-8 sm:w-8 p-0 touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleQuantityChange(item.id, -1)}
                      disabled={isOrdered}
                    >
                      <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                    <span className="w-5 sm:w-6 text-center font-bold text-xs sm:text-sm">{qty}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 sm:h-8 sm:w-8 p-0 touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleQuantityChange(item.id, 1)}
                      disabled={isOrdered}
                    >
                      <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                  </div>
                  
                  {isPizza && !('noSizeToggle' in item && item.noSizeToggle) && (
                    <div className="flex items-center gap-0.5 select-none">
                      <span 
                        className={`text-[10px] sm:text-xs font-semibold cursor-pointer px-0.5 ${!isFullPizza ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: false }))}
                      >
                        Half
                      </span>
                      <Switch
                        checked={isFullPizza}
                        onCheckedChange={(checked) => setPizzaSizes((prev) => ({ ...prev, [item.id]: checked }))}
                        className="scale-75 sm:scale-90"
                      />
                      <span 
                        className={`text-[10px] sm:text-xs font-semibold cursor-pointer px-0.5 ${isFullPizza ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setPizzaSizes((prev) => ({ ...prev, [item.id]: true }))}
                      >
                        Full
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Timer + Buttons */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {isOrdered && orderTimes[item.id] && (
                    <span className={`text-xs sm:text-sm font-mono font-bold w-10 sm:w-12 text-right ${
                      isOverdue(orderTimes[item.id]) ? "text-red-500" : "text-primary"
                    }`}>
                      {getTimeRemaining(orderTimes[item.id])}
                    </span>
                  )}
                  <div className="flex gap-0.5 sm:gap-1 w-24 sm:w-36">
                    {!isOrdered ? (
                      <Button
                        size="sm"
                        className="h-7 sm:h-8 flex-1 text-xs sm:text-sm font-bold touch-manipulation active:scale-95 transition-transform"
                        onClick={() => handleOrder(item.type, item.id)}
                      >
                        {menuMode === "takeaway" ? "Add" : "Order"}
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 active:bg-green-800 h-7 sm:h-8 flex-1 text-[10px] sm:text-xs font-bold touch-manipulation active:scale-95 transition-transform"
                          onClick={() => handleDelivered(orderId, item.id)}
                        >
                          <span className="hidden sm:inline">Delivered</span>
                          <Check className="h-3.5 w-3.5 sm:hidden" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 sm:h-8 flex-1 text-[10px] sm:text-xs font-bold touch-manipulation active:scale-95 transition-transform"
                          onClick={() => handleCancel(orderId, item.id)}
                        >
                          <span className="hidden sm:inline">Cancel</span>
                          <X className="h-3.5 w-3.5 sm:hidden" />
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
        <div className="flex justify-center mt-1 md:mt-2 shrink-0">
          <Button
            size="lg"
            variant="destructive"
            className={`h-9 sm:h-10 px-6 sm:px-10 text-sm sm:text-base font-bold select-none transition-all duration-150 ${
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
