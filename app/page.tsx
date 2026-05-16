"use client"

import { useState, useEffect, useRef } from "react"
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
  
  const buzzerContextRef = useRef<AudioContext | null>(null)
  const buzzerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const orderSoundRef = useRef<AudioContext | null>(null)

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

  const playOrderSound = () => {
    if (!orderSoundRef.current) {
      orderSoundRef.current = new AudioContext()
    }
    const ctx = orderSoundRef.current
    
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(1.0, startTime)
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }
    
    const now = ctx.currentTime
    playTone(523, now, 0.1)        // C5
    playTone(659, now + 0.1, 0.1)  // E5
    playTone(784, now + 0.2, 0.2)  // G5
  }

  const playCancelSound = () => {
    if (!orderSoundRef.current) {
      orderSoundRef.current = new AudioContext()
    }
    const ctx = orderSoundRef.current
    
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(1.0, startTime)
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }
    
    const now = ctx.currentTime
    playTone(400, now, 0.15)       // Descending tone
    playTone(300, now + 0.15, 0.2) // Lower tone
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
      playOrderSound()
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
    playCancelSound()
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

  const playBeep = () => {
    if (!buzzerContextRef.current) {
      buzzerContextRef.current = new AudioContext()
    }
    const ctx = buzzerContextRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.type = "square"
    osc.frequency.value = 800
    gain.gain.setValueAtTime(1.0, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  }

  const startBuzzer = () => {
    playBeep()
    buzzerIntervalRef.current = setInterval(playBeep, 300)
  }

  const stopBuzzer = () => {
    if (buzzerIntervalRef.current) {
      clearInterval(buzzerIntervalRef.current)
      buzzerIntervalRef.current = null
    }
  }

  const handleSirenStart = async () => {
    setIsCallingStaff(true)
    startBuzzer()
    await fetch("/api/siren", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    })
  }

  const handleSirenStop = async () => {
    setIsCallingStaff(false)
    stopBuzzer()
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
    <div className="h-screen bg-background p-6 flex gap-6">
      {/* Menu Panel */}
      <div className="flex-1 flex flex-col min-h-0">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-foreground">Menu</h1>
          <Link href="/kitchen">
            <Button variant="outline" size="lg" className="gap-3 text-lg px-6">
              <ChefHat className="h-6 w-6" />
              Kitchen
            </Button>
          </Link>
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

      {/* Cooking Panel */}
      <div className="w-80 bg-card border border-border rounded-xl p-4 flex flex-col">
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-3">
          <ChefHat className="h-7 w-7 text-primary" />
          Now Cooking
        </h2>
        <div className="flex-1 overflow-y-auto space-y-3">
          {activeOrders.length === 0 ? (
            <p className="text-muted-foreground text-lg text-center py-8">
              No orders cooking
            </p>
          ) : (
            activeOrders.map((order) => (
              <div
                key={order.id}
                className="bg-muted/50 rounded-lg p-4 border border-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground font-medium">
                    #{order.id.slice(-4)}
                  </span>
                  <span
                    className={`text-sm px-3 py-1 rounded-full font-semibold ${
                      order.status === "preparing"
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {order.status === "preparing" ? "Cooking" : "Queued"}
                  </span>
                </div>
                {order.items.map((item, idx) => (
                  <div key={idx} className="text-lg font-semibold text-foreground">
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
