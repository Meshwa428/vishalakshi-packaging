"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Download, Search, FileSearch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils"
import type { ReportRow } from "@/app/(dashboard)/reports/page"
import * as XLSX from "xlsx"

interface StockReportProps {
  rows: ReportRow[]
  loading: boolean
  generated: boolean
  dateRange: { from: string; to: string } | null
  isAdmin: boolean
}

export function StockReport({ rows, loading, generated, dateRange, isAdmin }: StockReportProps) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.reel_no.toLowerCase().includes(q) ||
        r.party_name.toLowerCase().includes(q) ||
        r.invoice_number.toLowerCase().includes(q) ||
        (r.gsm?.toLowerCase().includes(q) ?? false)
    )
  }, [rows, search])

  const totals = useMemo(() => ({
    stock_in: filtered.reduce((s, r) => s + r.stock_in_weight, 0),
    stock_out: filtered.reduce((s, r) => s + r.stock_out_weight, 0),
    balance: filtered.reduce((s, r) => s + r.balance, 0),
  }), [filtered])

  const handleExport = () => {
    try {
      const label = dateRange ? `${dateRange.from}_to_${dateRange.to}` : "report"
      const data = filtered.map((r) => ({
        "Reel No": r.reel_no,
        Date: formatDate(r.date),
        "Invoice No": r.invoice_number,
        "Party Name": r.party_name,
        GSM: r.gsm ?? "",
        BF: r.bf ?? "",
        Type: r.type ?? "",
        Quality: r.quality ?? "",
        Size: r.size ?? "",
        "Stock In (kg)": r.stock_in_weight,
        "Stock Out (kg)": r.stock_out_weight,
        "Balance (kg)": r.balance,
      }))
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Stock Report")
      XLSX.writeFile(wb, `StockReport_${label}.xlsx`)
      toast.success("Report exported successfully!")
    } catch {
      toast.error("Failed to export. Please try again.")
    }
  }

  if (loading) return <ReportSkeleton />

  if (!generated) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground border rounded-lg">
        <FileSearch className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">Select a date range and click Generate</p>
        <p className="text-xs mt-1">The report will show stock in, consumption, and balance per reel</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border rounded-lg">
        <p className="text-sm">No stock entries found for the selected date range.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reel, party, invoice, GSM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={handleExport} className="gap-2 shrink-0">
          <Download className="h-4 w-4" />
          Download Excel
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                {["Reel No", "Date", "Invoice No", "Party Name", "GSM", "BF", "Type", "Quality"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
                <th className="text-right text-xs font-medium text-emerald-600 py-3 px-4 whitespace-nowrap">Stock In</th>
                <th className="text-right text-xs font-medium text-red-500 py-3 px-4 whitespace-nowrap">Stock Out</th>
                <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4 whitespace-nowrap">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <motion.tr
                  key={row.reel_no}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium">{row.reel_no}</td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="py-3 px-4">
                    {isAdmin ? (
                      <Link href={`/stock-entries/${row.stock_entry_id}?type=stock_in`} className="font-mono hover:underline text-foreground">
                        {row.invoice_number}
                      </Link>
                    ) : (
                      <span className="font-mono">{row.invoice_number}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{row.party_name}</td>
                  <td className="py-3 px-4">{row.gsm ?? "—"}</td>
                  <td className="py-3 px-4">{row.bf ?? "—"}</td>
                  <td className="py-3 px-4">{row.type ? <Badge variant="secondary">{row.type}</Badge> : "—"}</td>
                  <td className="py-3 px-4">{row.quality ?? "—"}</td>
                  <td className="py-3 px-4 text-right font-medium text-emerald-600 whitespace-nowrap">
                    +{row.stock_in_weight.toFixed(2)} kg
                  </td>
                  <td className="py-3 px-4 text-right font-medium whitespace-nowrap">
                    {row.stock_out_weight > 0 ? (
                      <span className="text-red-500">−{row.stock_out_weight.toFixed(2)} kg</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${row.balance < 0 ? "text-red-500" : row.balance === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                    {row.balance.toFixed(2)} kg
                  </td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40">
                <td className="py-3 px-4 text-xs font-medium text-muted-foreground" colSpan={8}>
                  Totals — {filtered.length} reel{filtered.length !== 1 ? "s" : ""}
                </td>
                <td className="py-3 px-4 text-right text-xs font-semibold text-emerald-600 whitespace-nowrap">
                  +{totals.stock_in.toFixed(2)} kg
                </td>
                <td className="py-3 px-4 text-right text-xs font-semibold text-red-500 whitespace-nowrap">
                  {totals.stock_out > 0 ? `−${totals.stock_out.toFixed(2)} kg` : "—"}
                </td>
                <td className={`py-3 px-4 text-right text-xs font-semibold whitespace-nowrap ${totals.balance < 0 ? "text-red-500" : "text-foreground"}`}>
                  {totals.balance.toFixed(2)} kg
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full max-w-sm rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 border-b flex gap-6">
          {Array.from({ length: 11 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-14 rounded" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-6 px-4 py-3 border-b last:border-0">
            {Array.from({ length: 11 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-14 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
