import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get all staff members
export async function GET() {
  
  const { data: staff, error } = await supabase
    .from("staff")
    .select("*")
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(staff)
}

// Create new staff member
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, pin } = body

  if (!name || !pin) {
    return NextResponse.json({ error: "Name and PIN are required" }, { status: 400 })
  }

  // Check if PIN already exists
  const { data: existingStaff } = await supabase
    .from("staff")
    .select("id")
    .eq("pin", pin)
    .single()

  if (existingStaff) {
    return NextResponse.json({ error: "PIN already in use" }, { status: 400 })
  }

  const { data: staff, error } = await supabase
    .from("staff")
    .insert({ name, pin })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(staff)
}

// Update staff member
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, name, pin, is_active } = body

  if (!id) {
    return NextResponse.json({ error: "Staff ID is required" }, { status: 400 })
  }

  // If updating PIN, check if it's already in use by another staff
  if (pin) {
    const { data: existingStaff } = await supabase
      .from("staff")
      .select("id")
      .eq("pin", pin)
      .neq("id", id)
      .single()

    if (existingStaff) {
      return NextResponse.json({ error: "PIN already in use" }, { status: 400 })
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(staff)
}

// Delete staff member
export async function DELETE(request: NextRequest) {
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
