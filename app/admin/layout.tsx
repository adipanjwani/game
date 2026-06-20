import { AdminPinGate } from "@/components/admin-pin-gate"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminPinGate>{children}</AdminPinGate>
}
