import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildStockEntriesWorkbook, workbookToBuffer } from "@/lib/excel"
import { sendBackupEmail } from "@/lib/email"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: Request) {
  logger.info("Daily backup cron triggered")

  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn("Daily backup: unauthorized request")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const today = new Date()
    const todayStr = today.toISOString().split("T")[0]

    logger.info("Fetching all stock entries for backup", { date: todayStr })

    const { data: entries, error } = await supabase
      .from("stock_entries")
      .select(`*, stock_entry_items(*)`)
      .order("date", { ascending: false })

    if (error) {
      logger.error("Failed to fetch entries for backup", error)
      return NextResponse.json({ error: "Database fetch failed" }, { status: 500 })
    }

    logger.info("Building Excel workbook", { entryCount: entries?.length ?? 0 })
    const wb = buildStockEntriesWorkbook(entries ?? [])
    const buffer = workbookToBuffer(wb)

    const filename = `StockEntries_Backup_${todayStr}.xlsx`
    await sendBackupEmail({
      subject: `Daily Stock Entry Backup — ${todayStr}`,
      body: `Automated daily backup of all stock entries as of ${todayStr}.\n\nTotal entries: ${entries?.length ?? 0}`,
      attachmentName: filename,
      attachmentBuffer: buffer,
    })

    logger.info("Daily backup completed successfully")
    return NextResponse.json({ success: true, entries: entries?.length ?? 0, file: filename })
  } catch (err) {
    logger.error("Daily backup failed", err)
    return NextResponse.json({ error: "Backup failed" }, { status: 500 })
  }
}
