"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Order } from "@/lib/pizza-data"
import { Button } from "@/components/ui/button"
import { Trash2, RefreshCw, Home, ChefHat, AlertTriangle, BarChart3, UserPlus, Users, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Staff {
  id: string
  name: string
  pin: string
  is_active: boolean
  created_at: string
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  
  // Staff management state
  const [staff, setStaff] = useState<Staff[]>([])
  const [isLoadingStaff, setIsLoadingStaff] = useState(true)
  const [newStaffName, setNewStaffName] = useState("")
  const [newStaffPin, setNewStaffPin] = useState("")
  const [isAddingStaff, setIsAddingStaff] = useState(false)
  const [staffError, setStaffError] = useState("")
  const [showPins, setShowPins] = useState<Record<string, boolean>>({})

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders")
      const data = await res.json()
      if (data.orders) {
        const serverOrders: Order[] = data.orders
        
        // Merge orders - add new ones, update existing, keep local ones
        setOrders((prevOrders) => {
          const prevOrderMap = new Map(prevOrders.map(o => [o.id, o]))
          const serverOrderMap = new Map(serverOrders.map(o => [o.id, o]))
          
          const mergedOrders: Order[] = []
          
          // Update existing orders with server data, keep if not in server
          prevOrders.forEach(prevOrder => {
            const serverOrder = serverOrderMap.get(prevOrder.id)
            if (serverOrder) {
              // Order exists on server - use server version
              mergedOrders.push(serverOrder)
            } else {
              // Order not on server - keep locally unless it was cleared
              mergedOrders.push(prevOrder)
            }
          })
          
          // Add new orders from server
          serverOrders.forEach(serverOrder => {
            if (!prevOrderMap.has(serverOrder.id)) {
              mergedOrders.push(serverOrder)
            }
          })
          
          return mergedOrders
        })
      }
      setLastRefresh(new Date())
      setIsLoading(false)
    } catch (error) {
      console.error("Failed to fetch orders:", error)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    fetchStaff()
    // Poll every 2 seconds
    const interval = setInterval(fetchOrders, 2000)
    return () => clearInterval(interval)
  }, [])

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/staff")
      const data = await res.json()
      if (Array.isArray(data)) {
        setStaff(data)
      }
    } catch (error) {
      console.error("Failed to fetch staff:", error)
    }
    setIsLoadingStaff(false)
  }

  const handleAddStaff = async () => {
    if (!newStaffName.trim() || !newStaffPin.trim()) {
      setStaffError("Name and PIN are required")
      return
    }
    if (newStaffPin.length < 4) {
      setStaffError("PIN must be at least 4 digits")
      return
    }

    setIsAddingStaff(true)
    setStaffError("")

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStaffName.trim(), pin: newStaffPin.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setStaffError(data.error || "Failed to add staff")
      } else {
        setNewStaffName("")
        setNewStaffPin("")
        fetchStaff()
      }
    } catch {
      setStaffError("Failed to add staff")
    }
    setIsAddingStaff(false)
  }

  const handleToggleStaffActive = async (staffMember: Staff) => {
    try {
      await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: staffMember.id, is_active: !staffMember.is_active }),
      })
      fetchStaff()
    } catch (error) {
      console.error("Failed to update staff:", error)
    }
  }

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm("Are you sure you want to delete this staff member? This will also delete their time clock records.")) {
      return
    }

    try {
      await fetch(`/api/staff?id=${staffId}`, { method: "DELETE" })
      fetchStaff()
    } catch (error) {
      console.error("Failed to delete staff:", error)
    }
  }

  const toggleShowPin = (staffId: string) => {
    setShowPins(prev => ({ ...prev, [staffId]: !prev[staffId] }))
  }

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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Panel</h1>
          <div className="flex items-center gap-2">
            <Link href="/admin/statistics">
              <Button variant="outline" size="sm" className="gap-1">
                <BarChart3 className="h-4 w-4" />
                Stats
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
          <h2 className="text-lg font-semibold mb-4 text-foreground">Pending Orders</h2>
          
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : pendingOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No pending orders</div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className={`border rounded-lg p-3 ${
                    order.orderType === "takeaway"
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

        {/* Staff Management */}
        <div className="bg-card border border-border rounded-lg p-4 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Staff Management</h2>
          </div>

          {/* Add New Staff */}
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-3 text-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add New Staff
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Staff name"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="PIN (min 4 digits)"
                type="password"
                value={newStaffPin}
                onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="flex-1 sm:max-w-[160px]"
              />
              <Button
                onClick={handleAddStaff}
                disabled={isAddingStaff || !newStaffName.trim() || newStaffPin.length < 4}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {isAddingStaff ? "Adding..." : "Add Staff"}
              </Button>
            </div>
            {staffError && (
              <p className="text-sm text-destructive mt-2">{staffError}</p>
            )}
          </div>

          {/* Staff List */}
          {isLoadingStaff ? (
            <div className="text-center py-4 text-muted-foreground">Loading staff...</div>
          ) : staff.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No staff members added yet</div>
          ) : (
            <div className="space-y-2">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    member.is_active
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-muted/50 border-border opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-foreground">{member.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>PIN: </span>
                        <span className="font-mono">
                          {showPins[member.id] ? member.pin : "••••"}
                        </span>
                        <button
                          onClick={() => toggleShowPin(member.id)}
                          className="hover:text-foreground"
                        >
                          {showPins[member.id] ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={member.is_active ? "secondary" : "default"}
                      size="sm"
                      onClick={() => handleToggleStaffActive(member)}
                    >
                      {member.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteStaff(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
