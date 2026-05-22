import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { OrderItem } from "@/lib/pizza-data"
import { broadcastState } from "@/lib/store"

// Update a specific order (for takeaway delivered/cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createClient()
    const { orderId } = await params
    const body = await request.json()
    const { status } = body as { status: string }

    const { data: order, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId)
      .select()
      .single()

    if (error) {
      console.error("[v0] Supabase error updating order:", error)
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const transformedOrder = {
      id: order.id,
      items: order.items as OrderItem[],
      status: order.status,
      createdAt: order.created_at,
      tableNumber: order.table_number,
      orderType: order.order_type,
      orderNumber: order.order_number,
    }

    broadcastState()

    return NextResponse.json({ order: transformedOrder })
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
    const supabase = await createClient()
    const { orderId } = await params
    
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId)

    if (error) {
      console.error("[v0] Supabase error deleting order:", error)
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    broadcastState()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting order:", error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
