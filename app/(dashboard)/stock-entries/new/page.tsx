"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, PackagePlus, PackageMinus } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/PageHeader"
import { EntryForm } from "@/components/stock-entry/EntryForm"
import { StockOutForm } from "@/components/stock-entry/StockOutForm"
import { useSettings } from "@/hooks/useSettings"
import type { EntryType } from "@/types"

export default function NewStockEntryPage() {
  const { settings, loading } = useSettings()
  const [entryType, setEntryType] = useState<EntryType>("stock_in")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/stock-entries" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <PageHeader
        title="New Stock Entry"
        description="Fill in the details below to create a new stock entry"
      />

      {/* Stock In / Stock Out toggle */}
      <div className="flex items-center gap-2 p-1 rounded-lg bg-muted w-fit">
        <button
          type="button"
          onClick={() => setEntryType("stock_in")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            entryType === "stock_in"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <PackagePlus className="h-4 w-4" />
          Stock In
        </button>
        <button
          type="button"
          onClick={() => setEntryType("stock_out")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            entryType === "stock_out"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <PackageMinus className="h-4 w-4" />
          Stock Out
        </button>
      </div>

      {loading ? (
        <NewEntryFormSkeleton />
      ) : entryType === "stock_in" ? (
        <EntryForm settings={settings} />
      ) : (
        <StockOutForm settings={settings} />
      )}
    </div>
  )
}

function NewEntryFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-6 space-y-4">
        <Skeleton className="h-5 w-28 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28 rounded" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
}
