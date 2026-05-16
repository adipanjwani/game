import { NextRequest, NextResponse } from "next/server"

// In-memory state for siren
let sirenActive = false
let sirenLastUpdate = Date.now()

export async function GET() {
  // Auto-deactivate siren if no update in 500ms (button released or disconnected)
  if (sirenActive && Date.now() - sirenLastUpdate > 500) {
    sirenActive = false
  }
  return NextResponse.json({ active: sirenActive })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { active } = body as { active: boolean }
    
    sirenActive = active
    sirenLastUpdate = Date.now()
    
    return NextResponse.json({ active: sirenActive })
  } catch (error) {
    console.error("[v0] Error updating siren:", error)
    return NextResponse.json({ error: "Failed to update siren" }, { status: 500 })
  }
}
