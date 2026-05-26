"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/PageHeader"
import { EntryList } from "@/components/stock-entry/EntryList"
import { createClient } from "@/lib/supabase/client"
import { useProfileContext } from "@/components/shared/ProfileProvider"
import { logger } from "@/lib/logger"
import type { UnifiedListEntry } from "@/types"

export default function StockEntriesPage() {
  const { isAdmin } = useProfileContext()
  const [entries, setEntries] = useState<UnifiedListEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from("stock_entries")
        .select(`id, invoice_number, date, truck_number, party_name, status, stock_entry_items(id)`)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("stock_out_entries")
        .select(`id, invoice_number, date, truck_number, party_name, status, stock_out_items(id)`)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]).then(([stockIn, stockOut]) => {
      if (stockIn.error) logger.error("Failed to fetch stock in entries", stockIn.error)
      if (stockOut.error) logger.error("Failed to fetch stock out entries", stockOut.error)

      const inEntries: UnifiedListEntry[] = (stockIn.data ?? []).map((e) => ({
        id: e.id,
        invoice_number: e.invoice_number,
        date: e.date,
        truck_number: e.truck_number,
        party_name: e.party_name,
        status: e.status,
        entry_type: "stock_in",
        items_count: (e.stock_entry_items as { id: string }[] | null)?.length ?? 0,
      }))

      const outEntries: UnifiedListEntry[] = (stockOut.data ?? []).map((e) => ({
        id: e.id,
        invoice_number: e.invoice_number,
        date: e.date,
        truck_number: e.truck_number,
        party_name: e.party_name,
        status: e.status,
        entry_type: "stock_out",
        items_count: (e.stock_out_items as { id: string }[] | null)?.length ?? 0,
      }))

      // Merge and sort by date descending
      const merged = [...inEntries, ...outEntries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setEntries(merged)
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Entries"
        description="All stock in and stock out entries"
        action={
          <Link href="/stock-entries/new" className={cn(buttonVariants(), "gap-2")}>
            <Plus className="h-4 w-4" />
            New Entry
          </Link>
        }
      />
      <EntryList entries={entries} isAdmin={isAdmin} loading={loading} />
    </div>
  )
}
