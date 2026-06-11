"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { AppSettings } from "@/types"

const defaultSettings: AppSettings = {
  type_options: ["Kraft", "Duplex", "Corrugated", "White Back", "Brown"],
  gsm_options: ["80", "90", "100", "120", "150", "180", "200", "250"],
  bf_options: ["14", "16", "18", "20", "22", "24", "26"],
  quality_options: ["Natural", "Golden", "Imported", "Duplex", "Cadbory"],
  supplier_options: [],
}

// Cached across pages — settings rarely change, so serve the last result
// instantly and refresh in the background instead of re-querying + showing a
// skeleton on every page that needs them.
let settingsCache: AppSettings | null = null

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(settingsCache ?? defaultSettings)
  const [loading, setLoading] = useState(!settingsCache)

  const fetchSettings = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from("app_settings").select("setting_key, setting_values")
    if (data && data.length > 0) {
      const merged = { ...defaultSettings }
      data.forEach((row) => {
        const key = row.setting_key as keyof AppSettings
        if (key in merged) merged[key] = row.setting_values as string[]
      })
      settingsCache = merged
      setSettings(merged)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  return { settings, loading, refetch: fetchSettings }
}
