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
  const stream = new ReadableStream({
    start(controller) {
      globalForSSE.clients.add(controller)
      
      // Send initial connection message
      controller.enqueue(`data: {"type":"connected"}\n\n`)
      
      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`data: {"type":"heartbeat"}\n\n`)
        } catch {
          clearInterval(heartbeat)
          globalForSSE.clients.delete(controller)
        }
      }, 15000)
    },
    cancel() {
      // Client disconnected
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
