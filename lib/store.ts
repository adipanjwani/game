import { Order, OrderItem } from "./pizza-data"

// Global SSE client management (no order storage - use Supabase)
const globalStore = globalThis as unknown as {
  clients: Set<ReadableStreamDefaultController>
  lastUpdated: number
}

if (!globalStore.clients) {
  globalStore.clients = new Set()
}

if (!globalStore.lastUpdated) {
  globalStore.lastUpdated = Date.now()
}

// SSE client management
export function addClient(controller: ReadableStreamDefaultController): void {
  globalStore.clients.add(controller)
}

export function removeClient(controller: ReadableStreamDefaultController): void {
  globalStore.clients.delete(controller)
}

// Broadcast notification to all connected clients to refetch
export function broadcastState(): void {
  globalStore.lastUpdated = Date.now()
  const message = `data: ${JSON.stringify({
    type: "refresh",
    timestamp: globalStore.lastUpdated,
  })}\n\n`
  
  globalStore.clients.forEach((controller) => {
    try {
      controller.enqueue(message)
    } catch {
      globalStore.clients.delete(controller)
    }
  })
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

// Transform database order to app order format
export function transformOrder(dbOrder: {
  id: string
  items: unknown
  status: string
  created_at: string
  table_number: number | null
  order_type: string
  order_number: string | null
}): Order {
  return {
    id: dbOrder.id,
    items: dbOrder.items as OrderItem[],
    status: dbOrder.status as Order["status"],
    createdAt: new Date(dbOrder.created_at),
    tableNumber: dbOrder.table_number ?? undefined,
    orderType: dbOrder.order_type as "front" | "takeaway",
    orderNumber: dbOrder.order_number ?? undefined,
  }
}
