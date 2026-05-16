"use client"

import { Order } from "@/lib/pizza-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, ChefHat, CheckCircle, Package, Pizza, Sandwich } from "lucide-react"

interface OrderCardProps {
  order: Order
  onUpdateStatus: (orderId: string, status: Order["status"]) => void
}

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
    icon: Clock,
  },
  preparing: {
    label: "Preparing",
    color: "bg-blue-500/20 text-blue-700 border-blue-500/30",
    icon: ChefHat,
  },
  ready: {
    label: "Ready",
    color: "bg-green-500/20 text-green-700 border-green-500/30",
    icon: CheckCircle,
  },
  completed: {
    label: "Completed",
    color: "bg-muted text-muted-foreground border-muted",
    icon: Package,
  },
}

export function OrderCard({ order, onUpdateStatus }: OrderCardProps) {
  const status = statusConfig[order.status]
  const StatusIcon = status.icon

  const getNextStatus = (): Order["status"] | null => {
    switch (order.status) {
      case "pending":
        return "preparing"
      case "preparing":
        return "ready"
      case "ready":
        return "completed"
      default:
        return null
    }
  }

  const nextStatus = getNextStatus()

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono">{order.id}</CardTitle>
          <Badge variant="outline" className={status.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {order.tableNumber && <span>Table {order.tableNumber}</span>}
          <span>{new Date(order.createdAt).toLocaleTimeString()}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {order.items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div className="flex items-center gap-3">
                {item.pizza ? (
                  <Pizza className="h-6 w-6 text-primary" />
                ) : (
                  <Sandwich className="h-6 w-6 text-primary" />
                )}
                <div>
                  <p className="font-medium">
                    {item.pizza?.name || item.side?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.pizza && `${item.isFullPizza ? "Full" : "Half"} `}
                    x {item.quantity}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {nextStatus && (
          <Button
            className="w-full"
            onClick={() => onUpdateStatus(order.id, nextStatus)}
          >
            {nextStatus === "preparing" && "Start Preparing"}
            {nextStatus === "ready" && "Mark as Ready"}
            {nextStatus === "completed" && "Complete Order"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
