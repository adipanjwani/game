"use client"

import { Order, OrderItem } from "./pizza-data"

// Simple in-memory store for orders (shared between pages via polling)
// In production, you'd use a database

let orders: Order[] = []

export function getOrders(): Order[] {
  return [...orders]
}

export function addOrder(items: OrderItem[], tableNumber?: number): Order {
  const order: Order = {
    id: `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    items,
    status: "pending",
    createdAt: new Date(),
    tableNumber,
  }
  orders.push(order)
  return order
}

export function updateOrderStatus(orderId: string, status: Order["status"]): void {
  const order = orders.find((o) => o.id === orderId)
  if (order) {
    order.status = status
  }
}

export function clearCompletedOrders(): void {
  orders = orders.filter((o) => o.status !== "completed")
}
