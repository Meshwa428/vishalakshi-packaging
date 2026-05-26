"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Edit2, FileText } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EntryForm } from "@/components/stock-entry/EntryForm"
import { StockOutForm } from "@/components/stock-entry/StockOutForm"
import { useProfileContext } from "@/components/shared/ProfileProvider"
import { useSettings } from "@/hooks/useSettings"
import { createClient } from "@/lib/supabase/client"
import { formatDate, cn } from "@/lib/utils"
import { logger } from "@/lib/logger"
import type { StockEntry, StockEntryItem, StockOutEntry, StockOutItem } from "@/types"

type FullStockInEntry = StockEntry & { stock_entry_items: StockEntryItem[]; profiles: { full_name?: string } | null }
type FullStockOutEntry = StockOutEntry & { stock_out_items: StockOutItem[]; profiles: { full_name?: string } | null }

function StatusPill({ status }: { status: string }) {
  return status === "draft" ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-500 border border-amber-500/20">Draft</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">Done</span>
  )
}

export default function StockEntryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isAdmin } = useProfileContext()
  const { settings, loading: settingsLoading } = useSettings()

  const entryType = (searchParams.get("type") ?? "stock_in") as "stock_in" | "stock_out"
  const isEditMode = searchParams.get("edit") === "true" && isAdmin

  const [stockInEntry, setStockInEntry] = useState<FullStockInEntry | null>(null)
  const [stockOutEntry, setStockOutEntry] = useState<FullStockOutEntry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()

    if (entryType === "stock_in") {
      supabase
        .from("stock_entries")
        .select(`*, stock_entry_items(*), profiles(full_name)`)
        .eq("id", id)
        .single()
        .then(({ data, error }) => {
          if (error || !data) { logger.error("Stock in entry not found", { id, error }); router.replace("/stock-entries"); return }
          setStockInEntry(data as FullStockInEntry)
          setLoading(false)
        })
    } else {
      supabase
        .from("stock_out_entries")
        .select(`*, stock_out_items(*), profiles(full_name)`)
        .eq("id", id)
        .single()
        .then(({ data, error }) => {
          if (error || !data) { logger.error("Stock out entry not found", { id, error }); router.replace("/stock-entries"); return }
          setStockOutEntry(data as FullStockOutEntry)
          setLoading(false)
        })
    }
  }, [id, entryType, router])

  if (loading || settingsLoading) return <DetailSkeleton />

  // ─── Stock In Detail / Edit ──────────────────────────────────────────────

  if (entryType === "stock_in" && stockInEntry) {
    const entry = stockInEntry
    const items = entry.stock_entry_items ?? []
    const totalWeight = items.reduce((sum, i) => sum + (i.weight ?? 0), 0)

    if (isEditMode) {
      return (
        <div className="space-y-6">
          <BackLink href={`/stock-entries/${id}?type=stock_in`} label="Back" />
          <PageHeader title="Edit Stock In Entry" description={`Editing entry ${entry.invoice_number}`} />
          <EntryForm settings={settings} existingEntry={entry} isEdit />
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <BackLink href="/stock-entries" label="All Entries" />
        <PageHeader
          title={<span className="flex items-center gap-3">{entry.invoice_number} <StatusPill status={entry.status} /></span>}
          description={`Stock In — ${formatDate(entry.date)}`}
          action={isAdmin ? (
            <Link href={`/stock-entries/${id}?type=stock_in&edit=true`} className={cn(buttonVariants({ variant: entry.status === "draft" ? "default" : "outline" }), "gap-2")}>
              {entry.status === "draft" ? <><FileText className="h-4 w-4" />Edit &amp; Submit</> : <><Edit2 className="h-4 w-4" />Edit Entry</>}
            </Link>
          ) : undefined}
        />
        {entry.status === "draft" && <DraftBanner isAdmin={isAdmin} />}
        <SummaryCards items={[
          { label: "Date", value: formatDate(entry.date) },
          { label: "Party Name", value: entry.party_name },
          { label: "Truck No", value: entry.truck_number ?? "—" },
          { label: "Shipped From", value: entry.shipped_from ?? "—" },
          { label: "Delivery Address", value: entry.delivery_address ?? "—" },
          { label: "Total Reels", value: String(items.length) },
          { label: "Total Weight", value: `${totalWeight.toFixed(2)} kg` },
          { label: "Created By", value: entry.profiles?.full_name ?? "—" },
        ]} />
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Reel Details ({items.length})</CardTitle>
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
                  {items.map((item, i) => (
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
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td className="py-2.5 px-4 text-xs font-medium text-muted-foreground" colSpan={6}>Total — {items.length} reel{items.length !== 1 ? "s" : ""}</td>
                    <td className="py-2.5 px-4 text-xs font-medium">{totalWeight.toFixed(2)} kg</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Stock Out Detail / Edit ─────────────────────────────────────────────

  if (entryType === "stock_out" && stockOutEntry) {
    const entry = stockOutEntry
    const items = entry.stock_out_items ?? []
    const totalWeight = items.reduce((sum, i) => sum + (i.weight ?? 0), 0)

    if (isEditMode) {
      return (
        <div className="space-y-6">
          <BackLink href={`/stock-entries/${id}?type=stock_out`} label="Back" />
          <PageHeader title="Edit Stock Out Entry" description={`Editing entry ${entry.invoice_number}`} />
          <StockOutForm settings={settings} existingEntry={entry} isEdit />
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <BackLink href="/stock-entries" label="All Entries" />
        <PageHeader
          title={<span className="flex items-center gap-3">{entry.invoice_number} <StatusPill status={entry.status} /></span>}
          description={`Stock Out — ${formatDate(entry.date)}`}
          action={isAdmin ? (
            <Link href={`/stock-entries/${id}?type=stock_out&edit=true`} className={cn(buttonVariants({ variant: entry.status === "draft" ? "default" : "outline" }), "gap-2")}>
              {entry.status === "draft" ? <><FileText className="h-4 w-4" />Edit &amp; Submit</> : <><Edit2 className="h-4 w-4" />Edit Entry</>}
            </Link>
          ) : undefined}
        />
        {entry.status === "draft" && <DraftBanner isAdmin={isAdmin} />}
        <SummaryCards items={[
          { label: "Date", value: formatDate(entry.date) },
          { label: "Party Name", value: entry.party_name },
          { label: "Truck No", value: entry.truck_number ?? "—" },
          { label: "Shipped From", value: entry.shipped_from ?? "—" },
          { label: "Delivery Address", value: entry.delivery_address ?? "—" },
          { label: "Total Reels", value: String(items.length) },
          { label: "Total Weight", value: `${totalWeight.toFixed(2)} kg` },
          { label: "Created By", value: entry.profiles?.full_name ?? "—" },
        ]} />
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Reel Details ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    {["#", "GSM", "Reel No", "Size", "Type", "BF", "Quality", "Weight (kg)"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground py-3 px-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                      <td className="py-3 px-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-3 px-4">{item.gsm ?? "—"}</td>
                      <td className="py-3 px-4 font-mono">{item.reel_no}</td>
                      <td className="py-3 px-4">{item.size ?? "—"}</td>
                      <td className="py-3 px-4">{item.type ? <Badge variant="secondary">{item.type}</Badge> : "—"}</td>
                      <td className="py-3 px-4">{item.bf ?? "—"}</td>
                      <td className="py-3 px-4">{item.quality ?? "—"}</td>
                      <td className="py-3 px-4">{item.weight != null ? `${item.weight} kg` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td className="py-2.5 px-4 text-xs font-medium text-muted-foreground" colSpan={7}>Total — {items.length} reel{items.length !== 1 ? "s" : ""}</td>
                    <td className="py-2.5 px-4 text-xs font-medium">{totalWeight.toFixed(2)} kg</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

// ─── Shared sub-components ──────────────────────────────────────────────────

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 w-fit")}>
      <ArrowLeft className="h-4 w-4" />{label}
    </Link>
  )
}

function DraftBanner({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <FileText className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="font-medium text-amber-500">This entry is a draft</p>
        <p className="text-muted-foreground mt-0.5">
          {isAdmin ? 'Click "Edit & Submit" to review and finalise.' : "This entry is pending review by an admin."}
        </p>
      </div>
    </div>
  )
}

function SummaryCards({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
          <p className="text-sm font-medium truncate">{item.value}</p>
        </Card>
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-28 rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 rounded" />
        <Skeleton className="h-4 w-36 rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-2">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border">
        <div className="p-4 border-b"><Skeleton className="h-5 w-32 rounded" /></div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
