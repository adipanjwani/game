import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET - Fetch all active staff members
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: staff, error } = await supabase
      .from("staff")
      .select("id, name, pin")
      .eq("is_active", true)
      .order("name")
    
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
