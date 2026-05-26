import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/PageHeader"
import { EnumManager } from "@/components/settings/EnumManager"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const DEFAULT_SETTINGS = {
  type_options: { label: "Paper Type", description: "Options for the Type dropdown in stock entry forms", values: ["Kraft", "Duplex", "Corrugated", "White Back", "Brown"] },
  gsm_options: { label: "GSM", description: "GSM value options", values: ["80", "90", "100", "120", "150", "180", "200", "250"] },
  bf_options: { label: "BF", description: "Burst Factor value options", values: ["14", "16", "18", "20", "22", "24", "26"] },
  quality_options: { label: "Quality", description: "Quality grade options", values: ["Natural", "Golden", "Imported", "Duplex", "Cadbory"] },
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") redirect("/stock-entries")

  const { data: settingsRows } = await supabase.from("app_settings").select("setting_key, setting_values")

  const categories = Object.entries(DEFAULT_SETTINGS).map(([key, defaults]) => {
    const row = settingsRows?.find((r) => r.setting_key === key)
    return {
      key,
      label: defaults.label,
      description: defaults.description,
      values: (row?.setting_values as string[]) ?? defaults.values,
    }
  })

  logger.info("Settings page loaded", { userId: user.id })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage dropdown options used in stock entry forms. Changes take effect immediately."
      />
      <EnumManager categories={categories} />
    </div>
  )
}
