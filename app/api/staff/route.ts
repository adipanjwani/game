import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET - Fetch staff members (all=true for all, default is active only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const all = searchParams.get("all") === "true"
    
    let query = supabase
      .from("staff")
      .select("id, name, pin, is_active")
      .order("name")
    
    if (!all) {
      query = query.eq("is_active", true)
    }
    
    const { data: staff, error } = await query
    
    if (error) {
      console.error("Error fetching staff:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(staff || [])
  } catch (error) {
    console.error("Error in staff API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Add new staff member
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { name, pin } = await request.json()
    
    if (!name || !pin || pin.length !== 4) {
      return NextResponse.json({ error: "Name and 4-digit PIN required" }, { status: 400 })
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
    
    const { data, error } = await supabase
      .from("staff")
      .insert({ name, pin, is_active: true })
      .select()
      .single()
    
    if (error) {
      console.error("Error adding staff:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in staff API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
