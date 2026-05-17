"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Order } from "@/lib/pizza-data"
import { Pizza, AlertTriangle, Monitor, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sirenActive, setSirenActive] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  
  const DELIVERY_TIME_LIMIT = 7.5 * 60 * 1000 // 7.5 minutes in milliseconds
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const sirenIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  
  // Initialize AudioContext immediately on mount
  useEffect(() => {
    const initAudio = async () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume()
      }
    }
    
    // Initialize immediately
    initAudio()
  }, [])
  
  // Play notification sound for new orders
  const playNotificationSound = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state !== "running") return
    try {
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(880, ctx.currentTime)
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2)
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.4)
    } catch (error) {
      console.error("[v0] Error playing notification:", error)
    }
  }, [])

  // SSE for real-time state updates from centralized store
  useEffect(() => {
    const eventSource = new EventSource("/api/orders/stream")
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === "heartbeat") return
      
      if (data.type === "state_update" && data.state) {
        const serverOrders: Order[] = data.state.orders
        
        setOrders((prevOrders) => {
          const prevIds = new Set(prevOrders.map(o => o.id))
          const serverIds = new Set(serverOrders.map(o => o.id))
          
          const newOrderIds = serverOrders.filter(o => !prevIds.has(o.id))
          if (newOrderIds.length > 0 && prevOrders.length > 0) {
            playNotificationSound()
          }
          
          const prevStatusMap = new Map(prevOrders.map(o => [o.id, o.status]))
          const hasStatusChange = serverOrders.some(o => prevStatusMap.get(o.id) !== o.status)
          const hasRemovedOrders = prevOrders.some(o => !serverIds.has(o.id))
          
          if (newOrderIds.length > 0 || hasStatusChange || hasRemovedOrders) {
            return serverOrders
          }
          return prevOrders
        })
        setIsLoading(false)
      }
      
      if (data.type === "siren_update") {
        setSirenActive(data.active)
      }
    }
    
    eventSource.onerror = () => {
      setIsLoading(false)
    }
    
    return () => {
      eventSource.close()
    }
  }, [playNotificationSound])

  // Also poll siren as fallback (SSE siren may not always arrive)
  useEffect(() => {
    const checkSiren = async () => {
      try {
        const res = await fetch("/api/siren")
        const data = await res.json()
        setSirenActive(data.active)
      } catch {}
    }
    const interval = setInterval(checkSiren, 300)
    return () => clearInterval(interval)
  }, [])

  // Update current time every second for timer calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Play siren sound when active
  useEffect(() => {
    if (sirenActive) {
      if (!audioContextRef.current || audioContextRef.current.state !== "running") return
      const ctx = audioContextRef.current
      
      if (!oscillatorRef.current) {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.type = "sawtooth"
        oscillator.frequency.value = 800
        gainNode.gain.value = 0.4
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.start()
        
        oscillatorRef.current = oscillator
        gainNodeRef.current = gainNode
        
        // Modulate frequency for siren effect
        const modulate = () => {
          if (oscillatorRef.current && audioContextRef.current) {
            const time = audioContextRef.current.currentTime
            oscillatorRef.current.frequency.setValueAtTime(800, time)
            oscillatorRef.current.frequency.linearRampToValueAtTime(1200, time + 0.5)
            oscillatorRef.current.frequency.linearRampToValueAtTime(800, time + 1)
          }
        }
        modulate()
        sirenIntervalRef.current = setInterval(modulate, 1000)
      }
    } else {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current)
        sirenIntervalRef.current = null
      }
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop()
        } catch {}
        oscillatorRef.current = null
        gainNodeRef.current = null
      }
    }
  }, [sirenActive, audioEnabled])

  const activeOrders = orders
    .filter((o) => o.status === "pending" || o.status === "preparing")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

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
    <div className={`h-dvh bg-background p-2 md:p-3 lg:p-4 flex flex-col overflow-hidden ${sirenActive ? "animate-pulse" : ""}`}>
      {/* Siren Alert Overlay */}
      {sirenActive && (
        <div className="fixed inset-0 z-50 bg-red-500/30 pointer-events-none flex items-center justify-center animate-pulse">
          <div className="bg-red-600 text-white px-4 md:px-6 lg:px-8 py-3 md:py-5 lg:py-6 rounded-lg md:rounded-xl flex items-center gap-2 md:gap-3 shadow-2xl">
            <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10" />
            <span className="text-lg md:text-xl lg:text-2xl font-bold">Front is empty.</span>
            <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10" />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-2 md:mb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 md:gap-2">
            <Pizza className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 text-primary" />
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-foreground">Kitchen Display</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-500 flex items-center gap-1">
              <Volume2 className="h-3.5 w-3.5" />
              Sound On
            </span>
            <Button asChild size="sm" className="text-xs md:text-sm">
              <Link href="/">
                <Monitor className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden md:inline">Front View</span>
                <span className="md:hidden">Front</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Orders Display */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-base md:text-lg lg:text-xl">
          Loading orders...
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Pizza className="h-10 w-10 md:h-12 md:w-12 lg:h-16 lg:w-16 mb-2 md:mb-3 lg:mb-4 text-muted-foreground/50" />
          <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground">No active orders</p>
          <p className="text-xs md:text-sm lg:text-base text-muted-foreground mt-1">
            Waiting for new orders...
          </p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5 md:gap-2 lg:gap-3 auto-rows-fr overflow-y-auto overflow-x-hidden">
          {activeOrders.map((order) => {
            const overdue = isOverdue(order.createdAt)
            return (
            <div
              key={order.id}
              className={`border-2 rounded-lg md:rounded-xl p-2 md:p-3 lg:p-4 flex flex-col ${
                overdue 
                  ? "bg-red-500/20 border-red-500 animate-pulse" 
                  : "bg-card border-border"
              }`}
            >
              {/* Timer */}
              <div className="flex items-center justify-end mb-1 md:mb-2">
                <span className={`text-sm md:text-lg lg:text-xl font-mono font-bold ${
                  overdue ? "text-red-500" : "text-foreground"
                }`}>
                  {getTimeRemaining(order.createdAt)}
                </span>
              </div>

              {/* Order Items */}
              <div className="flex-1 flex flex-col justify-center space-y-1 md:space-y-2">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm md:text-xl lg:text-2xl font-bold text-foreground">
                      {item.pizza?.name || item.side?.name}
                    </span>
                    <span className="text-[10px] md:text-sm lg:text-lg text-muted-foreground font-semibold">
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
