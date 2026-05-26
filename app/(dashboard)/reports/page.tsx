import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/PageHeader"
import { ReportTable } from "@/components/reports/ReportTable"
import { MonthYearSelector } from "@/components/reports/MonthYearSelector"
import { getCurrentMonthYear, monthName } from "@/lib/utils"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const { month: mParam, year: yParam } = await searchParams
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear()

  const month = mParam ? Number(mParam) : currentMonth
  const year = yParam ? Number(yParam) : currentYear

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const isAdmin = profile?.role === "admin"

  // Fetch reel items where the parent entry's date falls in the selected month/year
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const endDate = new Date(year, month, 0).toISOString().split("T")[0] // last day of month

  const { data: items, error } = await supabase
    .from("stock_entry_items")
    .select(`*, stock_entries!inner(id, invoice_number, date, party_name)`)
    .gte("stock_entries.date", startDate)
    .lte("stock_entries.date", endDate)
    .order("stock_entries.date", { ascending: true })

  if (error) {
    logger.error("Failed to fetch report items", error)
  }

  logger.info("Reports page loaded", { month, year, count: items?.length ?? 0 })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Report"
        description={`Reel-wise stock report — ${monthName(month)} ${year}`}
        action={<MonthYearSelector month={month} year={year} />}
      />
      <ReportTable items={items ?? []} month={month} year={year} isAdmin={isAdmin} />
    </div>
  )
}
