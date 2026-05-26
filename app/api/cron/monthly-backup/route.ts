import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildReportWorkbook, workbookToBuffer } from "@/lib/excel"
import { sendBackupEmail } from "@/lib/email"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: Request) {
  logger.info("Monthly report backup cron triggered")

  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn("Monthly backup: unauthorized request")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date()
    // If running on 30th, report is for current month; otherwise previous
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const endDate = new Date(year, month, 0).toISOString().split("T")[0]
    const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" })

    logger.info("Fetching reel items for monthly report", { month, year, startDate, endDate })

    const { data: items, error } = await supabase
      .from("stock_entry_items")
      .select(`*, stock_entries!inner(id, invoice_number, date, party_name)`)
      .gte("stock_entries.date", startDate)
      .lte("stock_entries.date", endDate)
      .order("stock_entries.date", { ascending: true })

    if (error) {
      logger.error("Failed to fetch items for monthly report", error)
      return NextResponse.json({ error: "Database fetch failed" }, { status: 500 })
    }

    logger.info("Building monthly report workbook", { itemCount: items?.length ?? 0 })
    const wb = buildReportWorkbook(items ?? [], month, year)
    const buffer = workbookToBuffer(wb)

    const filename = `StockReport_${monthLabel.replace(" ", "_")}.xlsx`
    await sendBackupEmail({
      subject: `Monthly Stock Report — ${monthLabel}`,
      body: `Automated monthly stock report for ${monthLabel}.\n\nTotal reels: ${items?.length ?? 0}`,
      attachmentName: filename,
      attachmentBuffer: buffer,
    })

    logger.info("Monthly report backup completed successfully")
    return NextResponse.json({ success: true, items: items?.length ?? 0, file: filename })
  } catch (err) {
    logger.error("Monthly backup failed", err)
    return NextResponse.json({ error: "Backup failed" }, { status: 500 })
  }
}
