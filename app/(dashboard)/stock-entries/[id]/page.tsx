import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Edit2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/PageHeader"
import { EntryForm } from "@/components/stock-entry/EntryForm"
import { createClient } from "@/lib/supabase/server"
import { formatDate, cn } from "@/lib/utils"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}

export default async function StockEntryDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { edit } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const isAdmin = profile?.role === "admin"
  const isEditMode = edit === "true" && isAdmin

  const { data: entry, error } = await supabase
    .from("stock_entries")
    .select(`*, stock_entry_items(*), profiles(full_name)`)
    .eq("id", id)
    .single()

  if (error || !entry) {
    logger.error("Stock entry not found", { id, error })
    notFound()
  }

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

  logger.info("Stock entry detail loaded", { id, isEditMode })

  const entryItems = entry.stock_entry_items ?? []
  const totalWeight = entryItems.reduce((sum: number, i: { weight: number | null }) => sum + (i.weight ?? 0), 0)

  if (isEditMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/stock-entries/${id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}>
            <ArrowLeft className="h-4 w-4" />Back
          </Link>
        </div>
        <PageHeader title="Edit Stock Entry" description={`Editing entry ${entry.invoice_number}`} />
        <EntryForm settings={settings} existingEntry={entry} isEdit />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/stock-entries" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}>
          <ArrowLeft className="h-4 w-4" />All Entries
        </Link>
      </div>

      <PageHeader
        title={entry.invoice_number}
        description={`Stock entry — ${formatDate(entry.date)}`}
        action={
          isAdmin ? (
            <Link href={`/stock-entries/${id}?edit=true`} className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <Edit2 className="h-4 w-4" />
              Edit Entry
            </Link>
          ) : undefined
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Date", value: formatDate(entry.date) },
          { label: "Party Name", value: entry.party_name },
          { label: "Truck No", value: entry.truck_number ?? "—" },
          { label: "Shipped From", value: entry.shipped_from ?? "—" },
          { label: "Delivery Address", value: entry.delivery_address ?? "—" },
          { label: "Total Reels", value: String(entryItems.length) },
          { label: "Total Weight", value: `${totalWeight.toFixed(2)} kg` },
          { label: "Created By", value: (entry.profiles as { full_name?: string })?.full_name ?? "—" },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className="text-sm font-medium truncate">{item.value}</p>
          </Card>
        ))}
      </div>

      {/* Reel items table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Reel Details ({entryItems.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  {["Reel No", "Size", "Type", "GSM", "BF", "Quality", "Weight (kg)"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground py-3 px-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entryItems.map((item: { id: string; reel_no: string; size: string | null; type: string | null; gsm: string | null; bf: string | null; quality: string | null; weight: number | null }, i: number) => (
                  <tr key={item.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="py-3 px-4 font-mono">{item.reel_no}</td>
                    <td className="py-3 px-4">{item.size ?? "—"}</td>
                    <td className="py-3 px-4">{item.type ? <Badge variant="secondary">{item.type}</Badge> : "—"}</td>
                    <td className="py-3 px-4">{item.gsm ?? "—"}</td>
                    <td className="py-3 px-4">{item.bf ?? "—"}</td>
                    <td className="py-3 px-4">{item.quality ?? "—"}</td>
                    <td className="py-3 px-4">{item.weight != null ? `${item.weight} kg` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
