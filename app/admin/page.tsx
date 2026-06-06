"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Order } from "@/lib/pizza-data"
import { Button } from "@/components/ui/button"
import { Trash2, RefreshCw, Home, ChefHat, AlertTriangle, Clock, BarChart3, Users, CalendarDays, Volume2, Upload, Play } from "lucide-react"

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [isMounted, setIsMounted] = useState(false)

  // Notification sound settings
  const [soundUrl, setSoundUrl] = useState<string | null>(null)
  const [isUploadingSound, setIsUploadingSound] = useState(false)
  const [soundError, setSoundError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // Set mounted state
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders")
      const data = await res.json()
      if (data.orders) {
        setOrders(data.orders)
      }
      setLastRefresh(new Date())
      setIsLoading(false)
    } catch (error) {
      console.error("Failed to fetch orders:", error)
      setIsLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchOrders()
  }, [])

  // Fetch the current notification sound setting
  useEffect(() => {
    const fetchSound = async () => {
      try {
        const res = await fetch("/api/notification-sound")
        const data = await res.json()
        setSoundUrl(data.url ?? null)
      } catch (error) {
        console.error("Failed to fetch notification sound:", error)
      }
    }
    fetchSound()
  }, [])

  const handleSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSoundError(null)

    if (!file.type.startsWith("audio/")) {
      setSoundError("Please select an audio file (MP3, WAV, etc.)")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setSoundError("File must be smaller than 5MB")
      return
    }

    setIsUploadingSound(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/notification-sound", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setSoundError(data.error || "Upload failed")
      } else {
        setSoundUrl(data.url)
      }
    } catch (error) {
      console.error("Failed to upload sound:", error)
      setSoundError("Upload failed. Please try again.")
    }
    setIsUploadingSound(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleTestSound = () => {
    if (!soundUrl) return
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(soundUrl)
    } else {
      previewAudioRef.current.src = soundUrl
    }
    previewAudioRef.current.currentTime = 0
    previewAudioRef.current.play().catch((err) => {
      console.error("Failed to play sound:", err)
    })
  }

  const handleResetSound = async () => {
    if (!confirm("Reset to the default notification sound?")) return
    try {
      await fetch("/api/notification-sound", { method: "DELETE" })
      setSoundUrl(null)
      setSoundError(null)
    } catch (error) {
      console.error("Failed to reset sound:", error)
    }
  }

  // SSE for real-time refresh notifications
  useEffect(() => {
    const eventSource = new EventSource("/api/orders/stream")
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === "heartbeat" || data.type === "connected") return
      
      if (data.type === "refresh") {
        fetchOrders()
      }
    }
    
    return () => {
      eventSource.close()
    }
  }, [])

  // Fallback polling every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear ALL orders? This cannot be undone.")) {
      return
    }
    
    setIsClearing(true)
    try {
      await fetch("/api/orders?action=clear-all", { method: "DELETE" })
      setOrders([])
    } catch (error) {
      console.error("Failed to clear orders:", error)
      alert("Failed to clear orders")
    }
    setIsClearing(false)
  }

  const handleClearCompleted = async () => {
    if (!confirm("Clear all completed orders?")) {
      return
    }
    
    try {
      await fetch("/api/orders?action=clear-completed", { method: "DELETE" })
      fetchOrders()
    } catch (error) {
      console.error("Failed to clear completed orders:", error)
    }
  }

  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "preparing")
  const completedOrders = orders.filter(o => o.status === "completed" || o.status === "ready")
  const frontOrders = orders.filter(o => o.orderType === "front" || !o.orderType)
  const takeawayOrders = orders.filter(o => o.orderType === "takeaway")

  return (
    <div className="min-h-dvh bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Panel</h1>
            <div className="flex items-center gap-1.5 text-lg font-mono font-bold text-muted-foreground">
              <Clock className="h-5 w-5" />
              {isMounted ? currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "--:--:--"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/staff">
              <Button variant="outline" size="sm" className="gap-1">
                <Users className="h-4 w-4" />
                Staff
              </Button>
            </Link>
            <Link href="/admin/staff/timesheet">
              <Button variant="outline" size="sm" className="gap-1">
                <CalendarDays className="h-4 w-4" />
                Timesheet
              </Button>
            </Link>
            <Link href="/admin/hours">
              <Button variant="outline" size="sm" className="gap-1">
                <Clock className="h-4 w-4" />
                Hours
              </Button>
            </Link>
            <Link href="/admin/statistics">
              <Button variant="outline" size="sm" className="gap-1">
                <BarChart3 className="h-4 w-4" />
                Statistics
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-1">
                <Home className="h-4 w-4" />
                Front
              </Button>
            </Link>
            <Link href="/kitchen">
              <Button variant="outline" size="sm" className="gap-1">
                <ChefHat className="h-4 w-4" />
                Kitchen
              </Button>
            </Link>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{orders.length}</div>
            <div className="text-sm text-muted-foreground">Total Orders</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-amber-500">{pendingOrders.length}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-500">{frontOrders.length}</div>
            <div className="text-sm text-muted-foreground">Front Orders</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-green-500">{takeawayOrders.length}</div>
            <div className="text-sm text-muted-foreground">Takeaway Orders</div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-foreground">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={fetchOrders}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={handleClearCompleted}
              className="gap-2"
              disabled={completedOrders.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Clear Completed ({completedOrders.length})
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={isClearing || orders.length === 0}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              {isClearing ? "Clearing..." : `Clear All Orders (${orders.length})`}
            </Button>
          </div>
        </div>

        {/* Notification Sound */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 className="h-5 w-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Notification Sound</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a custom sound that plays in the Kitchen when a new order arrives. Leave empty to use the default alarm tone.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleSoundUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingSound}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {isUploadingSound ? "Uploading..." : soundUrl ? "Replace Sound" : "Upload Sound"}
            </Button>

            {soundUrl && (
              <>
                <Button variant="secondary" onClick={handleTestSound} className="gap-2">
                  <Play className="h-4 w-4" />
                  Test
                </Button>
                <Button variant="ghost" onClick={handleResetSound} className="gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Reset to Default
                </Button>
              </>
            )}
          </div>

          <div className="mt-3 text-sm">
            {soundError ? (
              <span className="text-destructive">{soundError}</span>
            ) : soundUrl ? (
              <span className="text-green-600">Custom notification sound is active.</span>
            ) : (
              <span className="text-muted-foreground">Using the default alarm tone. MP3 or WAV, up to 5MB.</span>
            )}
          </div>
        </div>

        {/* Last Refresh */}
        <div className="text-sm text-muted-foreground mb-4">
          Last refreshed: {isMounted ? lastRefresh.toLocaleTimeString() : "--:--:--"}
        </div>

        {/* Orders List */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4 text-foreground">All Orders</h2>
          
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No orders in the system</div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className={`border rounded-lg p-3 ${
                    order.status === "completed" 
                      ? "bg-green-500/10 border-green-500/30" 
                      : order.orderType === "takeaway"
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-blue-500/10 border-blue-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        order.orderType === "takeaway" 
                          ? "bg-amber-500 text-white" 
                          : "bg-blue-500 text-white"
                      }`}>
                        {order.orderType === "takeaway" ? "TAKEAWAY" : "FRONT"}
                      </span>
                      {order.orderNumber && (
                        <span className="text-sm font-bold text-foreground">#{order.orderNumber}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        order.status === "pending" ? "bg-yellow-500/20 text-yellow-600" :
                        order.status === "preparing" ? "bg-orange-500/20 text-orange-600" :
                        order.status === "ready" ? "bg-blue-500/20 text-blue-600" :
                        "bg-green-500/20 text-green-600"
                      }`}>
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-foreground">
                    {order.items.map((item, idx) => (
                      <span key={idx}>
                        {idx > 0 && ", "}
                        {item.pizza?.name || item.side?.name}
                        {item.pizza && (
                          <span className="text-muted-foreground">
                            {" "}({item.baseType 
                              ? `${!item.isFullPizza ? "Half " : ""}${item.baseType === "15-thick" ? "15\" Thick" : item.baseType === "15-thin" ? "15\" Thin" : "12\" Thin"}`
                              : (item.isFullPizza ? "Full" : "Half")
                            })
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ID: {order.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
