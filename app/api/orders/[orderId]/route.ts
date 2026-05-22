import { NextRequest, NextResponse } from "next/server"
import { updateOrder, removeOrder } from "@/lib/store"

// Update a specific order (for takeaway delivered/cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const body = await request.json()
    const { status } = body as { status: string }

    const order = await updateOrder(orderId, { status: status as "pending" | "preparing" | "ready" | "completed" })
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error("[v0] Error updating order:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

// Delete a specific order (for takeaway cancel)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    
    const removed = await removeOrder(orderId)
    if (!removed) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting order:", error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
