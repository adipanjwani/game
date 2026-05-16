"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Order } from "@/lib/pizza-data"
import { Pizza, AlertTriangle } from "lucide-react"

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sirenActive, setSirenActive] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  
  const DELIVERY_TIME_LIMIT = 10 * 60 * 1000 // 10 minutes in milliseconds
  const audioContextRef = useRef<AudioContext | null>(null)
  const buzzerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/orders")
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
      }
    } catch (error) {
      // Silently ignore to prevent console spam
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 2000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  // Update current time every second for timer calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Poll for siren status
  useEffect(() => {
    let isMounted = true
    const checkSiren = async () => {
      try {
        const res = await fetch("/api/siren")
        if (isMounted && res.ok) {
          const data = await res.json()
          setSirenActive(data.active)
        }
      } catch (error) {
        // Silently ignore fetch errors to prevent console spam
      }
    }
    checkSiren()
    const interval = setInterval(checkSiren, 500)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // Play buzzer beeping sound when Call Staff is active
  useEffect(() => {
    if (!sirenActive) {
      if (buzzerIntervalRef.current) {
        clearInterval(buzzerIntervalRef.current)
        buzzerIntervalRef.current = null
      }
      return
    }

    // Create audio context once
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    
    const playBeep = () => {
      const ctx = audioContextRef.current
      if (!ctx) return
      
      try {
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
      } catch (e) {
        // Ignore audio errors
      }
    }

    playBeep()
    buzzerIntervalRef.current = setInterval(playBeep, 400)
    
    return () => {
      if (buzzerIntervalRef.current) {
        clearInterval(buzzerIntervalRef.current)
        buzzerIntervalRef.current = null
      }
    }
  }, [sirenActive])

  const activeOrders = orders.filter((o) => o.status === "pending" || o.status === "preparing")

  const isOverdue = (createdAt: string) => {
    const orderTime = new Date(createdAt).getTime()
    return currentTime - orderTime > DELIVERY_TIME_LIMIT
  }

  const getTimeRemaining = (createdAt: string) => {
    const orderTime = new Date(createdAt).getTime()
    const elapsed = currentTime - orderTime
    const remaining = DELIVERY_TIME_LIMIT - elapsed
    
    if (remaining <= 0) {
      const overdueSeconds = Math.floor(Math.abs(remaining) / 1000)
      const mins = Math.floor(overdueSeconds / 60)
      const secs = overdueSeconds % 60
      return `-${mins}:${secs.toString().padStart(2, '0')}`
    }
    
    const remainingSeconds = Math.floor(remaining / 1000)
    const mins = Math.floor(remainingSeconds / 60)
    const secs = remainingSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`min-h-screen bg-background p-6 ${sirenActive ? "animate-pulse" : ""}`}>
      {/* Siren Alert Overlay */}
      {sirenActive && (
        <div className="fixed inset-0 z-50 bg-red-500/30 pointer-events-none flex items-center justify-center animate-pulse">
          <div className="bg-red-600 text-white px-12 py-8 rounded-2xl flex items-center gap-4 shadow-2xl">
            <AlertTriangle className="h-16 w-16" />
            <span className="text-4xl font-bold">STAFF NEEDED!</span>
            <AlertTriangle className="h-16 w-16" />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <Pizza className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold text-foreground">Kitchen Display</h1>
        </div>
      </header>

      {/* Orders Display */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-2xl">
          Loading orders...
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="text-center py-24">
          <Pizza className="h-24 w-24 mx-auto mb-6 text-muted-foreground/50" />
          <p className="text-3xl text-muted-foreground">No active orders</p>
          <p className="text-lg text-muted-foreground mt-2">
            Waiting for new orders...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
          {activeOrders.map((order) => {
            const overdue = isOverdue(order.createdAt)
            return (
            <div
              key={order.id}
              className={`border-4 rounded-2xl p-8 min-h-[250px] flex flex-col ${
                overdue 
                  ? "bg-red-500/20 border-red-500 animate-pulse" 
                  : "bg-card border-border"
              }`}
            >
              {/* Timer */}
              <div className="flex items-center justify-end mb-4">
                <span className={`text-2xl font-mono font-bold ${
                  overdue ? "text-red-500" : "text-foreground"
                }`}>
                  {getTimeRemaining(order.createdAt)}
                </span>
              </div>

              {/* Order Items */}
              <div className="flex-1 flex flex-col justify-center space-y-6">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <span className="text-4xl font-bold text-foreground">
                      {item.pizza?.name || item.side?.name}
                    </span>
                    <span className="text-2xl text-muted-foreground font-semibold">
                      {item.quantity > 1 && `${item.quantity}x `}
                      {item.pizza && (item.isFullPizza ? "Full" : "Half")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
