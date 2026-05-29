import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// PATCH - Update staff member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const updates = await request.json()
    
    // If updating PIN, check it's not already in use
    if (updates.pin) {
      const { data: existingStaff } = await supabase
        .from("staff")
        .select("id")
        .eq("pin", updates.pin)
        .neq("id", id)
        .single()
      
      if (existingStaff) {
        return NextResponse.json({ error: "PIN already in use" }, { status: 400 })
      }
    }
    
    const { data, error } = await supabase
      .from("staff")
      .update(updates)
      .eq("id", id)
      .select()
      .single()
    
    if (error) {
      console.error("Error updating staff:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in staff API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete staff member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", id)
    
    if (error) {
      console.error("Error deleting staff:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in staff API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
