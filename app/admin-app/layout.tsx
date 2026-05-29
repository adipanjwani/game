import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Pizza Admin",
  description: "Admin management for Pizza POS",
  manifest: "/admin-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pizza Admin",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
}

export default function AdminAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
