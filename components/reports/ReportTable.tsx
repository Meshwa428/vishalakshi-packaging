"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils"
import type { StockEntryItem, StockEntry } from "@/types"
import * as XLSX from "xlsx"

type ReportItem = StockEntryItem & {
  stock_entries: Pick<StockEntry, "id" | "invoice_number" | "date" | "party_name">
}

interface ReportTableProps {
  items: ReportItem[]
  month: number
  year: number
  isAdmin: boolean
}

export function ReportTable({ items, month, year, isAdmin }: ReportTableProps) {
  const [search, setSearch] = useState("")

  const monthLabel = new Date(year, month - 1, 1).toLocaleString("default", { month: "long", year: "numeric" })

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return items
    return items.filter(
      (item) =>
        item.reel_no.toLowerCase().includes(q) ||
        item.stock_entries.party_name.toLowerCase().includes(q) ||
        item.stock_entries.invoice_number.toLowerCase().includes(q) ||
        (item.type?.toLowerCase().includes(q) ?? false)
    )
  }, [items, search])

  const handleExport = () => {
    try {
      const data = filtered.map((item) => ({
        "Reel No": item.reel_no,
        Date: formatDate(item.stock_entries.date),
        "Invoice No": item.stock_entries.invoice_number,
        "Party Name": item.stock_entries.party_name,
        GSM: item.gsm ?? "",
        BF: item.bf ?? "",
        Type: item.type ?? "",
        Quality: item.quality ?? "",
        Size: item.size ?? "",
        "Weight (kg)": item.weight ?? "",
      }))
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, monthLabel)
      XLSX.writeFile(wb, `Report_${monthLabel.replace(" ", "_")}.xlsx`)
      toast.success("Report exported successfully!")
    } catch {
      toast.error("Failed to export report. Please try again.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reel, party, invoice..."
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

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg">
          <p className="text-sm">{search ? "No reels match your search." : `No entries found for ${monthLabel}.`}</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                {["Reel No", "Date", "Invoice No", "Party Name", "GSM", "BF", "Type", "Quality", "Weight (kg)"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium">{item.reel_no}</td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{formatDate(item.stock_entries.date)}</td>
                  <td className="py-3 px-4">
                    {isAdmin ? (
                      <Link href={`/stock-entries/${item.stock_entries.id}`} className="font-mono hover:underline text-foreground">
                        {item.stock_entries.invoice_number}
                      </Link>
                    ) : (
                      <span className="font-mono">{item.stock_entries.invoice_number}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{item.stock_entries.party_name}</td>
                  <td className="py-3 px-4">{item.gsm ?? "—"}</td>
                  <td className="py-3 px-4">{item.bf ?? "—"}</td>
                  <td className="py-3 px-4">{item.type ? <Badge variant="secondary">{item.type}</Badge> : "—"}</td>
                  <td className="py-3 px-4">{item.quality ?? "—"}</td>
                  <td className="py-3 px-4">{item.weight != null ? `${item.weight} kg` : "—"}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} reel{filtered.length !== 1 ? "s" : ""} for {monthLabel}
      </p>
    </div>
  )
}
