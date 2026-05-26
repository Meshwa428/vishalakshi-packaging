"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { monthName } from "@/lib/utils"

interface MonthYearSelectorProps {
  month: number
  year: number
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

export function MonthYearSelector({ month, year }: MonthYearSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()

  const navigate = (m: number, y: number) => {
    router.push(`${pathname}?month=${m}&year=${y}`)
  }

  const prev = () => {
    if (month === 1) navigate(12, year - 1)
    else navigate(month - 1, year)
  }

  const next = () => {
    const now = new Date()
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    if (nextYear > now.getFullYear() || (nextYear === now.getFullYear() && nextMonth > now.getMonth() + 1)) return
    navigate(nextMonth, nextYear)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={prev} className="h-9 w-9">
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2">
        <Select value={String(month)} onValueChange={(v) => navigate(Number(v), year)}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue>{monthName(month)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m} value={String(m)}>{monthName(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={(v) => navigate(month, Number(v))}>
          <SelectTrigger className="w-[90px] h-9">
            <SelectValue>{year}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" size="icon" onClick={next} className="h-9 w-9">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
