import { Order } from "./pizza-data"
import { createClient } from "@supabase/supabase-js"

// Supabase client for route handlers (not using cookies)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// SSE client management (in-memory for broadcasting)
const globalStore = globalThis as unknown as {
  clients: Set<ReadableStreamDefaultController>
}

if (!globalStore.clients) {
  globalStore.clients = new Set()
}

// Database types
interface DbOrder {
  id: string
  items: Order["items"]
  status: Order["status"]
  created_at: string
  table_number: number | null
  order_type: "front" | "takeaway"
  order_number: string | null
}

// Convert DB order to app order
function dbToOrder(dbOrder: DbOrder): Order {
  return {
    id: dbOrder.id,
    items: dbOrder.items,
    status: dbOrder.status,
    createdAt: new Date(dbOrder.created_at),
    tableNumber: dbOrder.table_number ?? undefined,
    orderType: dbOrder.order_type,
    orderNumber: dbOrder.order_number ?? undefined,
  }
}

// Get orders from database
export async function getOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching orders:", error)
    return []
  }

  return (data as DbOrder[]).map(dbToOrder)
}

// Add an order to database
export async function addOrder(order: Order): Promise<Order | null> {
  const dbOrder = {
    id: order.id,
    items: order.items,
    status: order.status,
    created_at: order.createdAt.toISOString(),
    table_number: order.tableNumber ?? null,
    order_type: order.orderType || "front",
    order_number: order.orderNumber ?? null,
  }

  const { data, error } = await supabase
    .from("orders")
    .insert(dbOrder)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error adding order:", error)
    return null
  }

  await broadcastStateFromDb()
  return dbToOrder(data as DbOrder)
}

// Update an order in database
export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
  const dbUpdates: Record<string, unknown> = {}
  
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.tableNumber !== undefined) dbUpdates.table_number = updates.tableNumber
  if (updates.orderType !== undefined) dbUpdates.order_type = updates.orderType
  if (updates.orderNumber !== undefined) dbUpdates.order_number = updates.orderNumber

  const { data, error } = await supabase
    .from("orders")
    .update(dbUpdates)
    .eq("id", orderId)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error updating order:", error)
    return null
  }

  await broadcastStateFromDb()
  return dbToOrder(data as DbOrder)
}

// Remove completed orders from database
export async function clearCompletedOrders(): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("status", "completed")

  if (error) {
    console.error("[v0] Error clearing completed orders:", error)
    return
  }

  await broadcastStateFromDb()
}

// Clear all orders from database
export async function clearAllOrders(): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .delete()
    .neq("id", "")  // Delete all rows

  if (error) {
    console.error("[v0] Error clearing all orders:", error)
    return
  }

  await broadcastStateFromDb()
}

// Remove a specific order by ID from database
export async function removeOrder(orderId: string): Promise<boolean> {
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)

  if (error) {
    console.error("[v0] Error removing order:", error)
    return false
  }

  await broadcastStateFromDb()
  return true
}

// SSE client management
export function addClient(controller: ReadableStreamDefaultController): void {
  globalStore.clients.add(controller)
}

export function removeClient(controller: ReadableStreamDefaultController): void {
  globalStore.clients.delete(controller)
}

// Broadcast state from database to all connected clients
export async function broadcastStateFromDb(): Promise<void> {
  const orders = await getOrders()
  const message = `data: ${JSON.stringify({
    type: "state_update",
    state: {
      orders,
      lastUpdated: Date.now(),
    }
  })}\n\n`
  
  globalStore.clients.forEach((controller) => {
    try {
      controller.enqueue(message)
    } catch {
      globalStore.clients.delete(controller)
    }
  })
}

// Send current state to a specific client (from database)
export async function sendStateToClient(controller: ReadableStreamDefaultController): Promise<void> {
  const orders = await getOrders()
  const message = `data: ${JSON.stringify({
    type: "state_update",
    state: {
      orders,
      lastUpdated: Date.now(),
    }
  })}\n\n`
  
  try {
    controller.enqueue(message)
  } catch {
    globalStore.clients.delete(controller)
  }
}

// Broadcast siren state to all connected clients
export function broadcastSiren(active: boolean): void {
  const message = `data: ${JSON.stringify({
    type: "siren_update",
    active
  })}\n\n`
  
  globalStore.clients.forEach((controller) => {
    try {
      controller.enqueue(message)
    } catch {
      globalStore.clients.delete(controller)
    }
  })
}

// Legacy function for compatibility - now fetches from database
export async function getState(): Promise<{ orders: Order[], lastUpdated: number }> {
  const orders = await getOrders()
  return {
    orders,
    lastUpdated: Date.now(),
  }
}
