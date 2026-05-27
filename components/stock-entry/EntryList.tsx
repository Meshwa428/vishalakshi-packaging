"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Search, Eye, Edit2, SlidersHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, cn } from "@/lib/utils"
import type { UnifiedListEntry } from "@/types"

interface EntryListProps {
  entries: UnifiedListEntry[]
  isAdmin: boolean
  loading?: boolean
}

type TypeFilter = "all" | "stock_in" | "stock_out"
type StatusFilter = "all" | "done" | "draft"
type DateFilter = "all" | "today" | "this_week" | "this_month" | "custom"

const TYPE_LABELS: Record<TypeFilter, string> = { all: "All Types", stock_in: "Stock In", stock_out: "Stock Out" }
const STATUS_LABELS: Record<StatusFilter, string> = { all: "All Status", done: "Done", draft: "Draft" }
const DATE_LABELS: Record<DateFilter, string> = { all: "All Time", today: "Today", this_week: "This Week", this_month: "This Month", custom: "Custom Range" }

function getDateBoundary(filter: DateFilter): Date | null {
  const now = new Date()
  if (filter === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (filter === "this_week") {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(now.getFullYear(), now.getMonth(), diff)
  }
  if (filter === "this_month") return new Date(now.getFullYear(), now.getMonth(), 1)
  return null
}

const TypePill = ({ type }: { type: "stock_in" | "stock_out" }) =>
  type === "stock_in" ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
      Stock In
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-500 border border-red-500/20 whitespace-nowrap">
      Stock Out
    </span>
  )

const StatusPill = ({ status }: { status: "done" | "draft" }) =>
  status === "draft" ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-500 border border-amber-500/20">
      Draft
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      Done
    </span>
  )

export function EntryList({ entries, isAdmin, loading }: EntryListProps) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const dateBoundary = getDateBoundary(dateFilter)
    return entries.filter((e) => {
      if (q && !(
        e.invoice_number.toLowerCase().includes(q) ||
        e.party_name.toLowerCase().includes(q) ||
        (e.truck_number?.toLowerCase().includes(q) ?? false)
      )) return false
      if (typeFilter !== "all" && e.entry_type !== typeFilter) return false
      if (statusFilter !== "all" && e.status !== statusFilter) return false
      if (dateFilter === "custom") {
        const d = new Date(e.date)
        if (customFrom && d < new Date(customFrom)) return false
        if (customTo && d > new Date(customTo)) return false
      } else if (dateBoundary && new Date(e.date) < dateBoundary) {
        return false
      }
      return true
    })
  }, [entries, search, typeFilter, statusFilter, dateFilter, customFrom, customTo])

  const activeFilterCount = [
    typeFilter !== "all",
    statusFilter !== "all",
    dateFilter !== "all",
  ].filter(Boolean).length

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search + Filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice, party, truck..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
          className={cn("gap-2 h-10 shrink-0", activeFilterCount > 0 && "border-primary text-primary")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter row */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-3 p-3 rounded-lg bg-muted/40 border"
        >
          {/* Type */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Type</span>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="h-9 w-32 text-xs">
                <span className="truncate text-xs">{TYPE_LABELS[typeFilter]}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="stock_in">Stock In</SelectItem>
                <SelectItem value="stock_out">Stock Out</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Status</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-32 text-xs">
                <span className="truncate text-xs">{STATUS_LABELS[statusFilter]}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Date</span>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <span className="truncate text-xs">{DATE_LABELS[dateFilter]}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            {dateFilter === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 w-36 text-xs"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 w-36 text-xs"
                />
              </div>
            )}
          </div>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground"
              onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setDateFilter("all"); setCustomFrom(""); setCustomTo("") }}
            >
              Clear filters
            </Button>
          )}
        </motion.div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">{search || activeFilterCount > 0 ? "No entries match your filters." : "No stock entries yet. Create the first one!"}</p>
        </div>
      ) : (
        <>
          {/* ── Mobile card list (hidden on sm+) ── */}
          <div className="sm:hidden space-y-3">
            {filtered.map((entry, i) => (
              <motion.div
                key={`card-${entry.entry_type}-${entry.id}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                className="rounded-lg border p-4 space-y-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-base leading-tight">{entry.invoice_number}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{entry.party_name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <TypePill type={entry.entry_type} />
                    <StatusPill status={entry.status} />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span>{formatDate(entry.date)}</span>
                  {entry.truck_number && <><span>·</span><span>{entry.truck_number}</span></>}
                  <span>·</span>
                  <span>{entry.items_count} reel{entry.items_count !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/stock-entries/${entry.id}?type=${entry.entry_type}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 gap-1.5 h-10 justify-center")}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Link>
                  {isAdmin && (
                    <Link
                      href={`/stock-entries/${entry.id}?type=${entry.entry_type}&edit=true`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 gap-1.5 h-10 justify-center")}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Desktop table (hidden on mobile) ── */}
          <div className="hidden sm:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Invoice No</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Date</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Party Name</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4 hidden md:table-cell">Truck No</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4 hidden lg:table-cell">Reels</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Type</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Status</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <motion.tr
                    key={`${entry.entry_type}-${entry.id}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium">{entry.invoice_number}</td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="py-3 px-4">{entry.party_name}</td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {entry.truck_number ? (
                        <Badge variant="secondary">{entry.truck_number}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <Badge variant="outline">{entry.items_count} reels</Badge>
                    </td>
                    <td className="py-3 px-4"><TypePill type={entry.entry_type} /></td>
                    <td className="py-3 px-4"><StatusPill status={entry.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/stock-entries/${entry.id}?type=${entry.entry_type}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 gap-1")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                        {isAdmin && (
                          <Link
                            href={`/stock-entries/${entry.id}?type=${entry.entry_type}&edit=true`}
                            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 gap-1")}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {entries.length} entries
        </p>
      )}
    </div>
  )
}
