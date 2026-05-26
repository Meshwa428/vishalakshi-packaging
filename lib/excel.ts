import * as XLSX from "xlsx"
import type { StockEntry, StockEntryItem } from "@/types"
import { formatDate } from "@/lib/utils"

export function buildStockEntriesWorkbook(entries: (StockEntry & { stock_entry_items: StockEntryItem[] })[]) {
  const wb = XLSX.utils.book_new()

  // Summary sheet — one row per entry
  const summaryData = entries.map((e) => ({
    "Invoice No": e.invoice_number,
    Date: formatDate(e.date),
    "Truck No": e.truck_number ?? "",
    "Party Name": e.party_name,
    "Shipped From": e.shipped_from ?? "",
    "Delivery Address": e.delivery_address ?? "",
    "Total Reels": e.stock_entry_items?.length ?? 0,
    "Total Weight (kg)": e.stock_entry_items?.reduce((sum, i) => sum + (i.weight ?? 0), 0) ?? 0,
  }))
  const summarySheet = XLSX.utils.json_to_sheet(summaryData)
  autoWidth(summarySheet, summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, "Stock Entries")

  // Detail sheet — one row per reel item
  const itemData = entries.flatMap((e) =>
    (e.stock_entry_items ?? []).map((item) => ({
      "Invoice No": e.invoice_number,
      Date: formatDate(e.date),
      "Party Name": e.party_name,
      "Reel No": item.reel_no,
      Size: item.size ?? "",
      Type: item.type ?? "",
      GSM: item.gsm ?? "",
      BF: item.bf ?? "",
      Quality: item.quality ?? "",
      "Weight (kg)": item.weight ?? "",
    }))
  )
  const itemSheet = XLSX.utils.json_to_sheet(itemData)
  autoWidth(itemSheet, itemData)
  XLSX.utils.book_append_sheet(wb, itemSheet, "Reel Details")

  return wb
}

export function buildReportWorkbook(
  items: (StockEntryItem & { stock_entries: Pick<StockEntry, "invoice_number" | "date" | "party_name"> })[],
  month: number,
  year: number
) {
  const wb = XLSX.utils.book_new()

  const data = items.map((item) => ({
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

  const sheet = XLSX.utils.json_to_sheet(data)
  autoWidth(sheet, data)
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" })
  XLSX.utils.book_append_sheet(wb, sheet, `${monthName} ${year}`)

  return wb
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  const raw = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  return Buffer.from(raw)
}

function autoWidth(sheet: XLSX.WorkSheet, data: Record<string, unknown>[]) {
  if (!data.length) return
  const cols = Object.keys(data[0]).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? "").length)
    ) + 2,
  }))
  sheet["!cols"] = cols
}
