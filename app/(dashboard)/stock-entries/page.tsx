import Link from "next/link"
import { Plus } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/PageHeader"
import { EntryList } from "@/components/stock-entry/EntryList"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function StockEntriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const isAdmin = profile?.role === "admin"

  const { data: entries, error } = await supabase
    .from("stock_entries")
    .select(`*, stock_entry_items(*)`)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    logger.error("Failed to fetch stock entries", error)
  }

  logger.info("Stock entries page loaded", { count: entries?.length ?? 0 })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Entries"
        description="All stock and bill entries"
        action={
          <Link href="/stock-entries/new" className={cn(buttonVariants(), "gap-2")}>
            <Plus className="h-4 w-4" />
            New Entry
          </Link>
        }
      />
      <EntryList entries={entries ?? []} isAdmin={isAdmin} />
    </div>
  )
}
