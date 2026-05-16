import { NextRequest, NextResponse } from "next/server"
import { Order, OrderItem } from "@/lib/pizza-data"

// Use global to persist orders across hot module reloads in development
// For production, use a database
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
    const activeOrders = orders.filter((o) => o.status !== "completed")
    globalForOrders.orders.length = 0
    globalForOrders.orders.push(...activeOrders)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
