import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const SETTING_KEY = "notification_sound_url"
const BUCKET = "notification-sounds"
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// GET - return the currently configured notification sound URL (if any)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle()

    if (error) {
      console.error("[v0] Error fetching notification sound:", error)
      return NextResponse.json({ url: null })
    }

    return NextResponse.json({ url: data?.value ?? null })
  } catch (error) {
    console.error("[v0] Error in notification-sound GET:", error)
    return NextResponse.json({ url: null })
  }
}

// POST - upload a new notification sound file
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!file.type.startsWith("audio/")) {
      return NextResponse.json({ error: "File must be an audio file" }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be smaller than 5MB" }, { status: 400 })
    }

    const supabase = await createClient()

    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3"
    const filePath = `notification-${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error("[v0] Error uploading notification sound:", uploadError)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
    const publicUrl = publicUrlData.publicUrl

    const { error: settingError } = await supabase
      .from("app_settings")
      .upsert({ key: SETTING_KEY, value: publicUrl, updated_at: new Date().toISOString() })

    if (settingError) {
      console.error("[v0] Error saving notification sound setting:", settingError)
      return NextResponse.json({ error: "Failed to save setting" }, { status: 500 })
    }

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error("[v0] Error in notification-sound POST:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

// DELETE - reset to the default (synthesized) notification sound
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from("app_settings").delete().eq("key", SETTING_KEY)

    if (error) {
      console.error("[v0] Error deleting notification sound setting:", error)
      return NextResponse.json({ error: "Failed to reset" }, { status: 500 })
    }

    return NextResponse.json({ url: null })
  } catch (error) {
    console.error("[v0] Error in notification-sound DELETE:", error)
    return NextResponse.json({ error: "Reset failed" }, { status: 500 })
  }
}
