import { NextResponse } from "next/server"
import { addClient, removeClient } from "@/lib/store"

export const dynamic = 'force-dynamic'

export async function GET() {
  let heartbeatInterval: NodeJS.Timeout | null = null
  let controllerRef: ReadableStreamDefaultController | null = null
  
  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller
      addClient(controller)
      
      // Send initial connection message
      try {
        controller.enqueue(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      } catch {
        // Ignore errors on initial send
      }
      
      // Keep connection alive with heartbeat every 25s
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(`data: {"type":"heartbeat"}\n\n`)
        } catch {
          if (heartbeatInterval) clearInterval(heartbeatInterval)
          if (controllerRef) removeClient(controllerRef)
        }
      }, 25000)
    },
    cancel() {
      // Client disconnected - clean up
      if (heartbeatInterval) clearInterval(heartbeatInterval)
      if (controllerRef) removeClient(controllerRef)
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
