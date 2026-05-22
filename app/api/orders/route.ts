import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { OrderItem } from "@/lib/pizza-data"
import { broadcastState } from "@/lib/store"

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: true })
    
    if (error) {
      console.error("[v0] Supabase error fetching orders:", error)
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }

    // Transform database format to app format
    const transformedOrders = (orders || []).map(order => ({
      id: order.id,
      items: order.items as OrderItem[],
      status: order.status,
      createdAt: order.created_at,
      tableNumber: order.table_number,
      orderType: order.order_type,
      orderNumber: order.order_number,
    }))

    return NextResponse.json({ orders: transformedOrders })
  } catch (error) {
    console.error("[v0] Error fetching orders:", error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { items, tableNumber, orderType, orderNumber } = body as {
      items: OrderItem[]
      tableNumber?: number
      orderType?: "front" | "takeaway"
      orderNumber?: string
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        items: items,
        status: "pending",
        created_at: new Date().toISOString(),
        table_number: tableNumber || null,
        order_type: orderType || "front",
        order_number: orderNumber || null,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Supabase error creating order:", error)
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
    }

    // Transform and broadcast
    const transformedOrder = {
      id: order.id,
      items: order.items as OrderItem[],
      status: order.status,
      createdAt: order.created_at,
      tableNumber: order.table_number,
      orderType: order.order_type,
      orderNumber: order.order_number,
    }

    // Broadcast to connected SSE clients
    broadcastState()

    return NextResponse.json({ order: transformedOrder }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating order:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { orderId, status } = body as {
      orderId: string
      status: string
    }

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

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")

    if (action === "clear-completed") {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("status", "completed")

      if (error) {
        console.error("[v0] Supabase error clearing completed:", error)
        return NextResponse.json({ error: "Failed to clear orders" }, { status: 500 })
      }

      broadcastState()
      return NextResponse.json({ success: true })
    }

    if (action === "clear-all") {
      const { error } = await supabase
        .from("orders")
        .delete()
        .neq("id", "")

      if (error) {
        console.error("[v0] Supabase error clearing all:", error)
        return NextResponse.json({ error: "Failed to clear orders" }, { status: 500 })
      }

      broadcastState()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("[v0] Error in delete:", error)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
