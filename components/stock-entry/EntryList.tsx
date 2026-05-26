"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Search, Eye, Edit2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, cn } from "@/lib/utils"
import type { StockEntry } from "@/types"

interface EntryListProps {
  entries: StockEntry[]
  isAdmin: boolean
  loading?: boolean
}

export function EntryList({ entries, isAdmin, loading }: EntryListProps) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.invoice_number.toLowerCase().includes(q) ||
        e.party_name.toLowerCase().includes(q) ||
        (e.truck_number?.toLowerCase().includes(q) ?? false)
    )
  }, [entries, search])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by invoice, party name, or truck number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">{search ? "No entries match your search." : "No stock entries yet. Create the first one!"}</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Invoice No</th>
                <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4 hidden sm:table-cell">Party Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4 hidden md:table-cell">Truck No</th>
                <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4 hidden lg:table-cell">Reels</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium">{entry.invoice_number}</td>
                  <td className="py-3 px-4 text-muted-foreground">{formatDate(entry.date)}</td>
                  <td className="py-3 px-4 hidden sm:table-cell">{entry.party_name}</td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    {entry.truck_number ? (
                      <Badge variant="secondary">{entry.truck_number}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <Badge variant="outline">{entry.stock_entry_items?.length ?? 0} reels</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/stock-entries/${entry.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 gap-1")}>
                        <Eye className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">View</span>
                      </Link>
                      {isAdmin && (
                        <Link href={`/stock-entries/${entry.id}?edit=true`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 gap-1")}>
                          <Edit2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </Link>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {entries.length} entries
        </p>
      )}
    </div>
  )
}
