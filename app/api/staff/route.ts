import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: staff, error } = await supabase
      .from("staff")
      .select("*")
      .order("created_at", { ascending: true })
    
    if (error) {
      console.error("[v0] Supabase error fetching staff:", error)
      return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
    }

    return NextResponse.json({ staff: staff || [] })
  } catch (error) {
    console.error("[v0] Error fetching staff:", error)
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { name, pin } = body as { name: string; pin: string }

    if (!name || !pin) {
      return NextResponse.json({ error: "Name and PIN are required" }, { status: 400 })
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 })
    }

    // Check if PIN already exists
    const { data: existingStaff } = await supabase
      .from("staff")
      .select("id")
      .eq("pin", pin)
      .single()

    if (existingStaff) {
      return NextResponse.json({ error: "PIN already in use by another staff member" }, { status: 400 })
    }

    const { data: staff, error } = await supabase
      .from("staff")
      .insert({
        name,
        pin,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Supabase error creating staff:", error)
      return NextResponse.json({ error: "Failed to create staff" }, { status: 500 })
    }

    return NextResponse.json({ staff }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating staff:", error)
    return NextResponse.json({ error: "Failed to create staff" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, name, pin, is_active } = body as { 
      id: string
      name?: string
      pin?: string
      is_active?: boolean 
    }

    if (!id) {
      return NextResponse.json({ error: "Staff ID is required" }, { status: 400 })
    }

    if (pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 })
    }

    // Check if PIN already exists (excluding current staff)
    if (pin) {
      const { data: existingStaff } = await supabase
        .from("staff")
        .select("id")
        .eq("pin", pin)
        .neq("id", id)
        .single()

      if (existingStaff) {
        return NextResponse.json({ error: "PIN already in use by another staff member" }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (pin !== undefined) updateData.pin = pin
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: staff, error } = await supabase
      .from("staff")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Supabase error updating staff:", error)
      return NextResponse.json({ error: "Failed to update staff" }, { status: 500 })
    }

    return NextResponse.json({ staff })
  } catch (error) {
    console.error("[v0] Error updating staff:", error)
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Staff ID is required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[v0] Supabase error deleting staff:", error)
      return NextResponse.json({ error: "Failed to delete staff" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting staff:", error)
    return NextResponse.json({ error: "Failed to delete staff" }, { status: 500 })
  }
}
