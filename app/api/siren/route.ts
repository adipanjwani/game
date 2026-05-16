import { NextRequest, NextResponse } from "next/server"
import { broadcastSiren } from "@/lib/store"

// Use globalThis to persist siren state across hot reloads
const globalForSiren = globalThis as unknown as { 
  sirenActive: boolean
  sirenLastUpdate: number 
}
if (globalForSiren.sirenActive === undefined) {
  globalForSiren.sirenActive = false
  globalForSiren.sirenLastUpdate = Date.now()
}

export async function GET() {
  // Auto-deactivate siren if no update in 500ms (button released or disconnected)
  if (globalForSiren.sirenActive && Date.now() - globalForSiren.sirenLastUpdate > 500) {
    globalForSiren.sirenActive = false
    broadcastSiren(false)
  }
  return NextResponse.json({ active: globalForSiren.sirenActive })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { active } = body as { active: boolean }
    
    console.log("[v0] Siren POST received, active:", active)
    
    globalForSiren.sirenActive = active
    globalForSiren.sirenLastUpdate = Date.now()
    
    // Broadcast siren state to all connected clients via SSE
    console.log("[v0] Broadcasting siren state:", active)
    broadcastSiren(active)
    
    return NextResponse.json({ active: globalForSiren.sirenActive })
  } catch (error) {
    console.error("[v0] Error updating siren:", error)
    return NextResponse.json({ error: "Failed to update siren" }, { status: 500 })
  }
}
