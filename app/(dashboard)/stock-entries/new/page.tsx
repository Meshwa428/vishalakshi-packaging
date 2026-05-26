import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/PageHeader"
import { EntryForm } from "@/components/stock-entry/EntryForm"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

export default async function NewStockEntryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: settingsRows } = await supabase.from("app_settings").select("setting_key, setting_values")

  const defaultSettings = {
    type_options: ["Kraft", "Duplex", "Corrugated", "White Back", "Brown"],
    gsm_options: ["80", "90", "100", "120", "150", "180", "200", "250"],
    bf_options: ["14", "16", "18", "20", "22", "24", "26"],
    quality_options: ["Natural", "Golden", "Imported", "Duplex", "Cadbory"],
  }

  const settings = { ...defaultSettings }
  if (settingsRows) {
    settingsRows.forEach((row) => {
      const key = row.setting_key as keyof typeof settings
      if (key in settings) settings[key] = row.setting_values as string[]
    })
  }

  logger.info("New stock entry page loaded")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/stock-entries" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <PageHeader title="New Stock Entry" description="Fill in the details below to create a new stock entry" />
      <EntryForm settings={settings} />
    </div>
  )
}
