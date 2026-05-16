import { NextRequest, NextResponse } from "next/server"
import { Order, OrderItem } from "@/lib/pizza-data"
import { 
  getOrders, 
  addOrder, 
  updateOrder, 
  clearCompletedOrders, 
  clearAllOrders 
} from "@/lib/store"

export async function GET() {
  return NextResponse.json({ orders: getOrders() })
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

    addOrder(order)

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

    const order = updateOrder(orderId, { status })
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

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
    clearCompletedOrders()
    return NextResponse.json({ success: true })
  }

  if (action === "clear-all") {
    clearAllOrders()
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
