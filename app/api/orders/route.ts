import { NextRequest, NextResponse } from "next/server"
import { Order, OrderItem } from "@/lib/pizza-data"

// SSE broadcast function
const globalForSSE = globalThis as unknown as { 
  clients: Set<ReadableStreamDefaultController>
}
function broadcastOrderUpdate() {
  if (!globalForSSE.clients) return
  const message = `data: {"type":"orders_updated"}\n\n`
  globalForSSE.clients.forEach((controller) => {
    try {
      controller.enqueue(message)
    } catch {
      globalForSSE.clients.delete(controller)
    }
  })
}

// Use globalThis to persist orders across hot module reloads
const globalForOrders = globalThis as unknown as { orders: Order[] }
if (!globalForOrders.orders) {
  globalForOrders.orders = []
}
const orders = globalForOrders.orders

export async function GET() {
  return NextResponse.json({ orders })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, tableNumber } = body as {
      items: OrderItem[]
      tableNumber?: number
    }

    const order: Order = {
      id: `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      items,
      status: "pending",
      createdAt: new Date(),
      tableNumber,
    }

    orders.push(order)
    broadcastOrderUpdate()

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating order:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, status } = body as {
      orderId: string
      status: Order["status"]
    }

    const order = orders.find((o) => o.id === orderId)
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    order.status = status
    broadcastOrderUpdate()

    return NextResponse.json({ order })
  } catch (error) {
    console.error("[v0] Error updating order:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")

  if (action === "clear-completed") {
    for (let i = orders.length - 1; i >= 0; i--) {
      if (orders[i].status === "completed") {
        orders.splice(i, 1)
      }
    }
    broadcastOrderUpdate()
    return NextResponse.json({ success: true })
  }

  if (action === "clear-all") {
    orders.splice(0, orders.length)
    broadcastOrderUpdate()
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
