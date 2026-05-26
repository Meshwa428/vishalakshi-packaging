import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string, fmt = "dd MMM yyyy"): string {
  try {
    return format(parseISO(dateStr), fmt)
  } catch {
    return dateStr
  }
}

export function formatDateForInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toISOString().split("T")[0]
}

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("default", { month: "long" })
}

