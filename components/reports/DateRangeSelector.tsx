"use client"

import { useState } from "react"
import { Calendar, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DateRangeSelectorProps {
  onGenerate: (from: string, to: string) => void
  loading: boolean
}

export function DateRangeSelector({ onGenerate, loading }: DateRangeSelectorProps) {
  const today = new Date().toISOString().split("T")[0]
  const firstOfMonth = `${today.slice(0, 7)}-01`

  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(today)

  const handleGenerate = () => {
    if (!from || !to) return
    onGenerate(from, to)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex gap-3">
        <div className="space-y-1.5 flex-1 sm:flex-none">
          <Label className="text-xs text-muted-foreground">From</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 pl-8 w-full sm:w-44 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5 flex-1 sm:flex-none">
          <Label className="text-xs text-muted-foreground">To</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 pl-8 w-full sm:w-44 text-sm"
            />
          </div>
        </div>
      </div>
      <Button
        onClick={handleGenerate}
        disabled={loading || !from || !to}
        size="sm"
        className="h-9 gap-2 w-full sm:w-auto"
      >
        <Search className="h-3.5 w-3.5" />
        {loading ? "Loading..." : "Generate"}
      </Button>
    </div>
  )
}
