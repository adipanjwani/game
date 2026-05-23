"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Order } from "@/lib/pizza-data"
import { Button } from "@/components/ui/button"
import { Trash2, RefreshCw, Home, ChefHat, AlertTriangle, Clock, BarChart3, Users, CalendarDays } from "lucide-react"

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

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
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/staff">
              <Button variant="outline" size="sm" className="gap-1">
                <Users className="h-4 w-4" />
                Staff
              </Button>
            </Link>
            <Link href="/admin/timesheet">
              <Button variant="outline" size="sm" className="gap-1">
                <CalendarDays className="h-4 w-4" />
                Timesheet
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

        {/* Last Refresh */}
        <div className="text-sm text-muted-foreground mb-4">
          Last refreshed: {lastRefresh.toLocaleTimeString()}
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
