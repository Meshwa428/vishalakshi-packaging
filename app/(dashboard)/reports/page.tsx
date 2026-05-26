"use client"

import { useState, useCallback } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StockReport } from "@/components/reports/StockReport"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { useProfileContext } from "@/components/shared/ProfileProvider"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/logger"
import type { StockEntryItem, StockOutItem } from "@/types"

export interface ReportRow {
  reel_no: string
  date: string
  invoice_number: string
  party_name: string
  gsm: string | null
  bf: string | null
  type: string | null
  quality: string | null
  size: string | null
  stock_in_weight: number
  stock_out_weight: number
  balance: number
  stock_entry_id: string
}

type StockInItemRaw = StockEntryItem & {
  stock_entries: { id: string; invoice_number: string; date: string; party_name: string }
}

type StockOutItemRaw = StockOutItem & {
  stock_out_entries: { id: string }
}

export default function ReportsPage() {
  const { isAdmin } = useProfileContext()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)

  const handleGenerate = useCallback(async (from: string, to: string) => {
    setLoading(true)
    setDateRange({ from, to })
    const supabase = createClient()

    try {
      // 1. Get all stock-in items in date range
      const { data: inItems, error: inError } = await supabase
        .from("stock_entries")
        .select(`id, invoice_number, date, party_name, stock_entry_items(*)`)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })

      if (inError) { logger.error("Failed to fetch stock in for report", inError); return }

      // Flatten to per-item rows
      const flatIn: StockInItemRaw[] = (inItems ?? []).flatMap((entry) =>
        (entry.stock_entry_items ?? []).map((item) => ({
          ...item,
          stock_entries: {
            id: entry.id,
            invoice_number: entry.invoice_number,
            date: entry.date,
            party_name: entry.party_name,
          },
        }))
      )

      if (flatIn.length === 0) {
        setRows([])
        setGenerated(true)
        setLoading(false)
        return
      }

      // 2. Get all stock-out items for these reel numbers
      const reelNos = flatIn.map((i) => i.reel_no)
      const { data: outItems, error: outError } = await supabase
        .from("stock_out_items")
        .select(`reel_no, weight`)
        .in("reel_no", reelNos)

      if (outError) logger.error("Failed to fetch stock out for report", outError)

      // 3. Build a map: reel_no → total stock out weight
      const outMap = new Map<string, number>()
      ;(outItems ?? []).forEach((item: StockOutItemRaw | { reel_no: string; weight: number | null }) => {
        const prev = outMap.get(item.reel_no) ?? 0
        outMap.set(item.reel_no, prev + (item.weight ?? 0))
      })

      // 4. Build report rows
      const reportRows: ReportRow[] = flatIn.map((item) => {
        const stock_in_weight = item.weight ?? 0
        const stock_out_weight = outMap.get(item.reel_no) ?? 0
        return {
          reel_no: item.reel_no,
          date: item.stock_entries.date,
          invoice_number: item.stock_entries.invoice_number,
          party_name: item.stock_entries.party_name,
          gsm: item.gsm,
          bf: item.bf,
          type: item.type,
          quality: item.quality,
          size: item.size,
          stock_in_weight,
          stock_out_weight,
          balance: stock_in_weight - stock_out_weight,
          stock_entry_id: item.stock_entries.id,
        }
      })

      logger.info("Report generated", { from, to, rows: reportRows.length })
      setRows(reportRows)
      setGenerated(true)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Report"
        description="Reel-wise stock in, consumption, and balance"
        action={<DateRangeSelector onGenerate={handleGenerate} loading={loading} />}
      />
      <StockReport
        rows={rows}
        loading={loading}
        generated={generated}
        dateRange={dateRange}
        isAdmin={isAdmin}
      />
    </div>
  )
}
