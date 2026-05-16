import { Order } from "./pizza-data"

// Centralized data store for all connected devices
export interface AppState {
  orders: Order[]
  lastUpdated: number
}

// Global store persisted across hot reloads
const globalStore = globalThis as unknown as {
  appState: AppState
  clients: Set<ReadableStreamDefaultController>
}

if (!globalStore.appState) {
  globalStore.appState = {
    orders: [],
    lastUpdated: Date.now(),
  }
}

if (!globalStore.clients) {
  globalStore.clients = new Set()
}

// Get current state
export function getState(): AppState {
  return globalStore.appState
}

// Get orders
export function getOrders(): Order[] {
  return globalStore.appState.orders
}

// Add an order
export function addOrder(order: Order): void {
  globalStore.appState.orders.push(order)
  globalStore.appState.lastUpdated = Date.now()
  broadcastState()
}

// Update an order
export function updateOrder(orderId: string, updates: Partial<Order>): Order | null {
  const order = globalStore.appState.orders.find((o) => o.id === orderId)
  if (order) {
    Object.assign(order, updates)
    globalStore.appState.lastUpdated = Date.now()
    broadcastState()
    return order
  }
  return null
}

// Remove completed orders
export function clearCompletedOrders(): void {
  const orders = globalStore.appState.orders
  for (let i = orders.length - 1; i >= 0; i--) {
    if (orders[i].status === "completed") {
      orders.splice(i, 1)
    }
  }
  globalStore.appState.lastUpdated = Date.now()
  broadcastState()
}

// Clear all orders
export function clearAllOrders(): void {
  globalStore.appState.orders.splice(0, globalStore.appState.orders.length)
  globalStore.appState.lastUpdated = Date.now()
  broadcastState()
}

// SSE client management
export function addClient(controller: ReadableStreamDefaultController): void {
  globalStore.clients.add(controller)
}

export function removeClient(controller: ReadableStreamDefaultController): void {
  globalStore.clients.delete(controller)
}

// Broadcast full state to all connected clients
export function broadcastState(): void {
  const state = getState()
  const message = `data: ${JSON.stringify({
    type: "state_update",
    state: {
      orders: state.orders,
      lastUpdated: state.lastUpdated,
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

// Send current state to a specific client
export function sendStateToClient(controller: ReadableStreamDefaultController): void {
  const state = getState()
  const message = `data: ${JSON.stringify({
    type: "state_update",
    state: {
      orders: state.orders,
      lastUpdated: state.lastUpdated,
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
