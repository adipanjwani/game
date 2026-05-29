"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { 
  Users, 
  BarChart3, 
  Pizza, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ExternalLink
} from "lucide-react"
import Link from "next/link"
import { Order, Pizza as PizzaType, Side, pizzas as defaultPizzas, sides as defaultSides } from "@/lib/pizza-data"

type Tab = "staff" | "statistics" | "menu"

interface Staff {
  id: string
  name: string
  pin: string
  is_active: boolean
}

interface TimeEntry {
  id: string
  staff_id: string
  staff_name?: string
  clock_in: string
  clock_out: string | null
}

// Store hours: 6:00 PM - 6:00 AM (next day)
const STORE_OPEN_HOUR = 18
const STORE_CLOSE_HOUR = 6

type ViewMode = "daily" | "weekly"

function getBusinessDayStart(date: Date): Date {
  const d = new Date(date)
  if (d.getHours() < STORE_CLOSE_HOUR) {
    d.setDate(d.getDate() - 1)
  }
  d.setHours(STORE_OPEN_HOUR, 0, 0, 0)
  return d
}

function getBusinessDayEnd(date: Date): Date {
  const d = new Date(date)
  if (d.getHours() < STORE_CLOSE_HOUR) {
    d.setDate(d.getDate() - 1)
  }
  d.setDate(d.getDate() + 1)
  d.setHours(STORE_CLOSE_HOUR, 0, 0, 0)
  return d
}

function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }
  return `${start.toLocaleDateString('en-GB', options)} - ${end.toLocaleDateString('en-GB', options)}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  })
}

export default function AdminApp() {
  const [activeTab, setActiveTab] = useState<Tab>("staff")
  const [isLoading, setIsLoading] = useState(false)

  // Staff state
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState("")
  const [newStaffPin, setNewStaffPin] = useState("")
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [staffWeekStart, setStaffWeekStart] = useState(() => {
    // Get Monday of current week
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  // Statistics state
  const [orders, setOrders] = useState<Order[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("daily")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // Menu state - would need API for persistence
  const [pizzaMenu, setPizzaMenu] = useState<PizzaType[]>(defaultPizzas)
  const [sidesMenu, setSidesMenu] = useState<Side[]>(defaultSides)
  const [editingMenuItem, setEditingMenuItem] = useState<{type: 'pizza' | 'side', item: PizzaType | Side} | null>(null)
  const [showAddMenuItem, setShowAddMenuItem] = useState<'pizza' | 'side' | null>(null)
  const [newMenuItem, setNewMenuItem] = useState({ name: "", description: "", price: "" })

  // Fetch staff data
  const fetchStaffData = async () => {
    setIsLoading(true)
    try {
      const [staffRes, timeRes] = await Promise.all([
        fetch("/api/staff?all=true"),
        fetch(`/api/time-clock/entries?weekStart=${staffWeekStart.toISOString()}`)
      ])
      const staffData = await staffRes.json()
      const timeData = await timeRes.json()
      setStaffList(staffData)
      setTimeEntries(timeData)
    } catch (error) {
      console.error("Error fetching staff data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch orders
  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/orders")
      const data = await res.json()
      if (data.orders) {
        setOrders(data.orders)
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "staff") {
      fetchStaffData()
    } else if (activeTab === "statistics") {
      fetchOrders()
    }
  }, [activeTab, staffWeekStart])

  // Staff management functions
  const handleAddStaff = async () => {
    if (!newStaffName.trim() || newStaffPin.length !== 4) return
    
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStaffName, pin: newStaffPin })
      })
      if (res.ok) {
        setNewStaffName("")
        setNewStaffPin("")
        setShowAddStaff(false)
        fetchStaffData()
      }
    } catch (error) {
      console.error("Error adding staff:", error)
    }
  }

  const handleUpdateStaff = async () => {
    if (!editingStaff) return
    
    try {
      const res = await fetch(`/api/staff/${editingStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: editingStaff.name, 
          pin: editingStaff.pin,
          is_active: editingStaff.is_active 
        })
      })
      if (res.ok) {
        setEditingStaff(null)
        fetchStaffData()
      }
    } catch (error) {
      console.error("Error updating staff:", error)
    }
  }

  const handleDeleteStaff = async (id: string) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return
    
    try {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchStaffData()
      }
    } catch (error) {
      console.error("Error deleting staff:", error)
    }
  }

  // Calculate weekly hours for a staff member
  const getWeeklyHours = (staffId: string) => {
    const entries = timeEntries.filter(e => e.staff_id === staffId && e.clock_out)
    let totalMinutes = 0
    entries.forEach(entry => {
      const clockIn = new Date(entry.clock_in)
      const clockOut = new Date(entry.clock_out!)
      totalMinutes += (clockOut.getTime() - clockIn.getTime()) / (1000 * 60)
    })
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)
    return `${hours}h ${minutes}m`
  }

  // Statistics calculations
  const getDateRange = () => {
    const start = getBusinessDayStart(selectedDate)
    const end = getBusinessDayEnd(selectedDate)
    
    if (viewMode === "weekly") {
      const weekStart = new Date(start)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(STORE_OPEN_HOUR, 0, 0, 0)
      
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      weekEnd.setHours(STORE_CLOSE_HOUR, 0, 0, 0)
      
      return { start: weekStart, end: weekEnd }
    }
    
    return { start, end }
  }

  const { start: rangeStart, end: rangeEnd } = getDateRange()

  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.createdAt)
    return orderDate >= rangeStart && orderDate < rangeEnd
  })

  const frontOrders = filteredOrders.filter(o => o.orderType === "front" || !o.orderType)
  const takeawayOrders = filteredOrders.filter(o => o.orderType === "takeaway")

  const getItemBreakdown = (orderList: Order[]) => {
    const breakdown: Record<string, { count: number; name: string }> = {}
    
    orderList.forEach(order => {
      order.items.forEach(item => {
        const name = item.pizza?.name || item.side?.name || "Unknown"
        const countValue = item.pizza && !item.isFullPizza ? 0.5 : 1
        if (breakdown[name]) {
          breakdown[name].count += countValue
        } else {
          breakdown[name] = { count: countValue, name }
        }
      })
    })
    
    return Object.values(breakdown).sort((a, b) => b.count - a.count)
  }

  const frontBreakdown = getItemBreakdown(frontOrders)
  const takeawayBreakdown = getItemBreakdown(takeawayOrders)

  const navigateDate = (direction: number) => {
    const newDate = new Date(selectedDate)
    if (viewMode === "weekly") {
      newDate.setDate(newDate.getDate() + (direction * 7))
    } else {
      newDate.setDate(newDate.getDate() + direction)
    }
    setSelectedDate(newDate)
  }

  const navigateStaffWeek = (direction: number) => {
    const newDate = new Date(staffWeekStart)
    newDate.setDate(newDate.getDate() + (direction * 7))
    setStaffWeekStart(newDate)
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
  {/* Header */}
  <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
    <Link href="/">
      <Button variant="outline" size="sm" className="gap-1 h-7">
        <ExternalLink className="h-3.5 w-3.5" />
        <span className="text-xs">App</span>
      </Button>
    </Link>
  </div>
  <Button
            variant="outline" 
            size="sm" 
            onClick={() => {
              if (activeTab === "staff") fetchStaffData()
              else if (activeTab === "statistics") fetchOrders()
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 pb-24">
        {/* Staff Tab */}
        {activeTab === "staff" && (
          <div className="space-y-4">
            {/* Week Navigation */}
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={() => navigateStaffWeek(-1)} className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <div className="font-semibold text-sm">
                    {staffWeekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {
                      new Date(staffWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">Weekly Hours</div>
                </div>
                <Button variant="outline" size="icon" onClick={() => navigateStaffWeek(1)} className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Staff List */}
            <div className="space-y-2">
              {staffList.map(staff => (
                <div key={staff.id} className="bg-card border border-border rounded-lg p-3">
                  {editingStaff?.id === staff.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingStaff.name}
                        onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                        className="w-full h-10 px-3 bg-background border border-input rounded-md text-foreground"
                        placeholder="Name"
                      />
                      <input
                        type="text"
                        value={editingStaff.pin}
                        onChange={(e) => setEditingStaff({ ...editingStaff, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                        className="w-full h-10 px-3 bg-background border border-input rounded-md text-foreground"
                        placeholder="PIN (4 digits)"
                        maxLength={4}
                      />
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editingStaff.is_active}
                          onChange={(e) => setEditingStaff({ ...editingStaff, is_active: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">Active</span>
                      </label>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateStaff} className="flex-1">
                          <Check className="h-4 w-4 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingStaff(null)} className="flex-1">
                          <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {staff.name}
                          {!staff.is_active && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Inactive</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          PIN: {staff.pin} • Week: {getWeeklyHours(staff.id)}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditingStaff(staff)} className="h-8 w-8">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteStaff(staff.id)} className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Staff Form */}
            {showAddStaff ? (
              <div className="bg-card border border-border rounded-lg p-3 space-y-3">
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full h-10 px-3 bg-background border border-input rounded-md text-foreground"
                  placeholder="Staff Name"
                />
                <input
                  type="text"
                  value={newStaffPin}
                  onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full h-10 px-3 bg-background border border-input rounded-md text-foreground"
                  placeholder="4-digit PIN"
                  maxLength={4}
                />
                <div className="flex gap-2">
                  <Button onClick={handleAddStaff} disabled={!newStaffName.trim() || newStaffPin.length !== 4} className="flex-1">
                    <Check className="h-4 w-4 mr-1" /> Add Staff
                  </Button>
                  <Button variant="outline" onClick={() => { setShowAddStaff(false); setNewStaffName(""); setNewStaffPin("") }} className="flex-1">
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowAddStaff(true)} className="w-full" variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Add Staff Member
              </Button>
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === "statistics" && (
          <div className="space-y-4">
            {/* View Mode & Date Selection */}
            <div className="bg-card border border-border rounded-lg p-3 space-y-3">
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "daily" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("daily")}
                  className="flex-1"
                >
                  Daily
                </Button>
                <Button
                  variant={viewMode === "weekly" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("weekly")}
                  className="flex-1"
                >
                  Weekly
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <Calendar className="h-4 w-4" />
                    <span className="font-semibold text-sm">{formatDate(selectedDate)}</span>
                  </div>
                  <Button variant="link" size="sm" onClick={() => setSelectedDate(new Date())} className="h-auto p-0 text-xs">
                    Today
                  </Button>
                </div>
                <Button variant="outline" size="icon" onClick={() => navigateDate(1)} className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                {formatDateRange(rangeStart, rangeEnd)}
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-foreground">{filteredOrders.length}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-500">{frontOrders.length}</div>
                <div className="text-xs text-muted-foreground">Front</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-500">{takeawayOrders.length}</div>
                <div className="text-xs text-muted-foreground">Takeaway</div>
              </div>
            </div>

            {/* Breakdowns */}
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Front Orders
                </h3>
                {frontBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders</p>
                ) : (
                  <div className="space-y-1">
                    {frontBreakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-foreground">{item.name}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-card border border-border rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Takeaway Orders
                </h3>
                {takeawayBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders</p>
                ) : (
                  <div className="space-y-1">
                    {takeawayBreakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-foreground">{item.name}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Menu Tab */}
        {activeTab === "menu" && (
          <div className="space-y-4">
            {/* Pizzas Section */}
            <div>
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Pizza className="h-4 w-4" /> Pizzas
              </h3>
              <div className="space-y-2">
                {pizzaMenu.map(pizza => (
                  <div key={pizza.id} className="bg-card border border-border rounded-lg p-3">
                    {editingMenuItem?.type === 'pizza' && editingMenuItem.item.id === pizza.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={(editingMenuItem.item as PizzaType).name}
                          onChange={(e) => setEditingMenuItem({ 
                            ...editingMenuItem, 
                            item: { ...editingMenuItem.item, name: e.target.value } as PizzaType
                          })}
                          className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                          placeholder="Name"
                        />
                        <input
                          type="text"
                          value={(editingMenuItem.item as PizzaType).description}
                          onChange={(e) => setEditingMenuItem({ 
                            ...editingMenuItem, 
                            item: { ...editingMenuItem.item, description: e.target.value } as PizzaType
                          })}
                          className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                          placeholder="Description"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={(editingMenuItem.item as PizzaType).price}
                          onChange={(e) => setEditingMenuItem({ 
                            ...editingMenuItem, 
                            item: { ...editingMenuItem.item, price: parseFloat(e.target.value) || 0 } as PizzaType
                          })}
                          className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                          placeholder="Price"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => {
                            setPizzaMenu(pizzaMenu.map(p => p.id === pizza.id ? editingMenuItem.item as PizzaType : p))
                            setEditingMenuItem(null)
                          }} className="flex-1 h-8">
                            <Check className="h-3 w-3 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingMenuItem(null)} className="flex-1 h-8">
                            <X className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-foreground">{pizza.name}</div>
                          <div className="text-xs text-muted-foreground">{pizza.description}</div>
                          <div className="text-sm font-medium text-primary mt-1">${pizza.price.toFixed(2)}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditingMenuItem({ type: 'pizza', item: pizza })} className="h-8 w-8">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setPizzaMenu(pizzaMenu.filter(p => p.id !== pizza.id))} className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {showAddMenuItem === 'pizza' ? (
                <div className="bg-card border border-border rounded-lg p-3 mt-2 space-y-2">
                  <input
                    type="text"
                    value={newMenuItem.name}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                    placeholder="Pizza Name"
                  />
                  <input
                    type="text"
                    value={newMenuItem.description}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, description: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                    placeholder="Description"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newMenuItem.price}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                    placeholder="Price"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (newMenuItem.name && newMenuItem.price) {
                        setPizzaMenu([...pizzaMenu, {
                          id: newMenuItem.name.toLowerCase().replace(/\s+/g, '-'),
                          name: newMenuItem.name,
                          description: newMenuItem.description,
                          price: parseFloat(newMenuItem.price)
                        }])
                        setNewMenuItem({ name: "", description: "", price: "" })
                        setShowAddMenuItem(null)
                      }
                    }} className="flex-1 h-8">
                      <Check className="h-3 w-3 mr-1" /> Add
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowAddMenuItem(null); setNewMenuItem({ name: "", description: "", price: "" }) }} className="flex-1 h-8">
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setShowAddMenuItem('pizza')} className="w-full mt-2" variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Pizza
                </Button>
              )}
            </div>

            {/* Sides Section */}
            <div>
              <h3 className="font-semibold text-foreground mb-2">Sides</h3>
              <div className="space-y-2">
                {sidesMenu.map(side => (
                  <div key={side.id} className="bg-card border border-border rounded-lg p-3">
                    {editingMenuItem?.type === 'side' && editingMenuItem.item.id === side.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={(editingMenuItem.item as Side).name}
                          onChange={(e) => setEditingMenuItem({ 
                            ...editingMenuItem, 
                            item: { ...editingMenuItem.item, name: e.target.value } as Side
                          })}
                          className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                          placeholder="Name"
                        />
                        <input
                          type="text"
                          value={(editingMenuItem.item as Side).description}
                          onChange={(e) => setEditingMenuItem({ 
                            ...editingMenuItem, 
                            item: { ...editingMenuItem.item, description: e.target.value } as Side
                          })}
                          className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                          placeholder="Description"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={(editingMenuItem.item as Side).price}
                          onChange={(e) => setEditingMenuItem({ 
                            ...editingMenuItem, 
                            item: { ...editingMenuItem.item, price: parseFloat(e.target.value) || 0 } as Side
                          })}
                          className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                          placeholder="Price"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => {
                            setSidesMenu(sidesMenu.map(s => s.id === side.id ? editingMenuItem.item as Side : s))
                            setEditingMenuItem(null)
                          }} className="flex-1 h-8">
                            <Check className="h-3 w-3 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingMenuItem(null)} className="flex-1 h-8">
                            <X className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-foreground">{side.name}</div>
                          <div className="text-xs text-muted-foreground">{side.description}</div>
                          <div className="text-sm font-medium text-primary mt-1">${side.price.toFixed(2)}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditingMenuItem({ type: 'side', item: side })} className="h-8 w-8">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setSidesMenu(sidesMenu.filter(s => s.id !== side.id))} className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {showAddMenuItem === 'side' ? (
                <div className="bg-card border border-border rounded-lg p-3 mt-2 space-y-2">
                  <input
                    type="text"
                    value={newMenuItem.name}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                    placeholder="Side Name"
                  />
                  <input
                    type="text"
                    value={newMenuItem.description}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, description: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                    placeholder="Description"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newMenuItem.price}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-input rounded-md text-foreground text-sm"
                    placeholder="Price"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (newMenuItem.name && newMenuItem.price) {
                        setSidesMenu([...sidesMenu, {
                          id: newMenuItem.name.toLowerCase().replace(/\s+/g, '-'),
                          name: newMenuItem.name,
                          description: newMenuItem.description,
                          price: parseFloat(newMenuItem.price)
                        }])
                        setNewMenuItem({ name: "", description: "", price: "" })
                        setShowAddMenuItem(null)
                      }
                    }} className="flex-1 h-8">
                      <Check className="h-3 w-3 mr-1" /> Add
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowAddMenuItem(null); setNewMenuItem({ name: "", description: "", price: "" }) }} className="flex-1 h-8">
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setShowAddMenuItem('side')} className="w-full mt-2" variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Side
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Note: Menu changes are temporary. Contact developer for permanent changes.
            </p>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-bottom">
        <div className="flex">
          <button
            onClick={() => setActiveTab("staff")}
            className={`flex-1 flex flex-col items-center py-3 gap-1 ${
              activeTab === "staff" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-xs font-medium">Staff</span>
          </button>
          <button
            onClick={() => setActiveTab("statistics")}
            className={`flex-1 flex flex-col items-center py-3 gap-1 ${
              activeTab === "statistics" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-xs font-medium">Statistics</span>
          </button>
          <button
            onClick={() => setActiveTab("menu")}
            className={`flex-1 flex flex-col items-center py-3 gap-1 ${
              activeTab === "menu" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Pizza className="h-5 w-5" />
            <span className="text-xs font-medium">Menu</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
