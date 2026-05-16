"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Order } from "@/lib/pizza-data"
import { Pizza, AlertTriangle, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sirenActive, setSirenActive] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  
  const DELIVERY_TIME_LIMIT = 5 * 1000 // 5 seconds in milliseconds
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/orders")
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders)
      }
    } catch (error) {
      console.error("[v0] Error fetching orders:", error)
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
    const checkSiren = async () => {
      try {
        const res = await fetch("/api/siren")
        const data = await res.json()
        setSirenActive(data.active)
      } catch (error) {
        console.error("[v0] Error checking siren:", error)
      }
    }
    checkSiren()
    const interval = setInterval(checkSiren, 200)
    return () => clearInterval(interval)
  }, [])

  // Play siren sound when active
  useEffect(() => {
    if (sirenActive) {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }
      const ctx = audioContextRef.current
      
      if (!oscillatorRef.current) {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.type = "sawtooth"
        oscillator.frequency.value = 800
        gainNode.gain.value = 0.3
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.start()
        
        const modulate = () => {
          if (oscillatorRef.current) {
            const time = ctx.currentTime
            oscillatorRef.current.frequency.setValueAtTime(800, time)
            oscillatorRef.current.frequency.linearRampToValueAtTime(1200, time + 0.5)
            oscillatorRef.current.frequency.linearRampToValueAtTime(800, time + 1)
          }
        }
        modulate()
        const sirenInterval = setInterval(modulate, 1000)
        
        oscillatorRef.current = oscillator
        ;(oscillatorRef.current as OscillatorNode & { sirenInterval?: NodeJS.Timeout }).sirenInterval = sirenInterval
      }
    } else {
      if (oscillatorRef.current) {
        const osc = oscillatorRef.current as OscillatorNode & { sirenInterval?: NodeJS.Timeout }
        if (osc.sirenInterval) {
          clearInterval(osc.sirenInterval)
        }
        oscillatorRef.current.stop()
        oscillatorRef.current = null
      }
    }
    
    return () => {
      if (oscillatorRef.current) {
        const osc = oscillatorRef.current as OscillatorNode & { sirenInterval?: NodeJS.Timeout }
        if (osc.sirenInterval) {
          clearInterval(osc.sirenInterval)
        }
        oscillatorRef.current.stop()
        oscillatorRef.current = null
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
    <div className={`h-[100dvh] bg-background p-2 sm:p-3 lg:p-4 flex flex-col overflow-hidden ${sirenActive ? "animate-pulse" : ""}`}>
      {/* Siren Alert Overlay */}
      {sirenActive && (
        <div className="fixed inset-0 z-50 bg-red-500/30 pointer-events-none flex items-center justify-center animate-pulse">
          <div className="bg-red-600 text-white px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 rounded-lg sm:rounded-xl flex items-center gap-2 sm:gap-3 shadow-2xl">
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" />
            <span className="text-lg sm:text-xl lg:text-2xl font-bold">STAFF NEEDED!</span>
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-2 sm:mb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Pizza className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-primary" />
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Kitchen Display</h1>
          </div>
          <Button asChild size="sm" className="text-xs sm:text-sm">
            <Link href="/">
              <Monitor className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Front View</span>
              <span className="sm:hidden">Front</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Orders Display */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-base sm:text-lg lg:text-xl">
          Loading orders...
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Pizza className="h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 mb-2 sm:mb-3 lg:mb-4 text-muted-foreground/50" />
          <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground">No active orders</p>
          <p className="text-xs sm:text-sm lg:text-base text-muted-foreground mt-1">
            Waiting for new orders...
          </p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-2 lg:gap-3 auto-rows-fr overflow-hidden">
          {activeOrders.map((order) => {
            const overdue = isOverdue(order.createdAt)
            return (
            <div
              key={order.id}
              className={`border-2 rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 flex flex-col ${
                overdue 
                  ? "bg-red-500/20 border-red-500 animate-pulse" 
                  : "bg-card border-border"
              }`}
            >
              {/* Timer */}
              <div className="flex items-center justify-end mb-1 sm:mb-2">
                <span className={`text-base sm:text-lg lg:text-xl font-mono font-bold ${
                  overdue ? "text-red-500" : "text-foreground"
                }`}>
                  {getTimeRemaining(order.createdAt)}
                </span>
              </div>

              {/* Order Items */}
              <div className="flex-1 flex flex-col justify-center space-y-1 sm:space-y-2">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <span className="text-base sm:text-xl lg:text-2xl font-bold text-foreground">
                      {item.pizza?.name || item.side?.name}
                    </span>
                    <span className="text-xs sm:text-sm lg:text-lg text-muted-foreground font-semibold">
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
