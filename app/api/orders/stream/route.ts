import { NextResponse } from "next/server"

// Store connected clients
const globalForSSE = globalThis as unknown as { 
  clients: Set<ReadableStreamDefaultController>
}
if (!globalForSSE.clients) {
  globalForSSE.clients = new Set()
}

export const dynamic = 'force-dynamic'

export async function GET() {
  let heartbeatInterval: NodeJS.Timeout | null = null
  let controllerRef: ReadableStreamDefaultController | null = null
  
  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller
      globalForSSE.clients.add(controller)
      
      // Send initial connection message
      controller.enqueue(`data: {"type":"connected"}\n\n`)
      
      // Keep connection alive with heartbeat every 30s
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(`data: {"type":"heartbeat"}\n\n`)
        } catch {
          if (heartbeatInterval) clearInterval(heartbeatInterval)
          globalForSSE.clients.delete(controller)
        }
      }, 30000)
    },
    cancel() {
      // Client disconnected - clean up
      if (heartbeatInterval) clearInterval(heartbeatInterval)
      if (controllerRef) globalForSSE.clients.delete(controllerRef)
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

// Function to broadcast updates to all connected clients
export function broadcastOrderUpdate() {
  const message = `data: {"type":"orders_updated"}\n\n`
  globalForSSE.clients.forEach((controller) => {
    try {
      controller.enqueue(message)
    } catch {
      globalForSSE.clients.delete(controller)
    }
  })
}
