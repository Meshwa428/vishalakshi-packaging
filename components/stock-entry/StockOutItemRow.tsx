"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Trash2 } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { AppSettings } from "@/types"

interface StockOutItemRowProps {
  index: number
  settings: AppSettings
  onRemove: () => void
  canRemove: boolean
  onEnterKey: () => void
}

interface ReelOption {
  reel_no: string
  size: string | null
  type: string | null
  bf: string | null
  quality: string | null
  weight: number | null
}

export function StockOutItemRow({ index, settings, onRemove, canRemove, onEnterKey }: StockOutItemRowProps) {
  const { register, setValue, control } = useFormContext()
  const [reelOptions, setReelOptions] = useState<ReelOption[]>([])
  const [loadingReels, setLoadingReels] = useState(false)

  const gsmVal = useWatch({ control, name: `items.${index}.gsm` })
  const reelVal = useWatch({ control, name: `items.${index}.reel_no` })

  // Fetch available reels when GSM changes
  useEffect(() => {
    if (!gsmVal) {
      setReelOptions([])
      return
    }
    setLoadingReels(true)
    // Reset dependant fields when GSM changes
    setValue(`items.${index}.reel_no`, "")
    setValue(`items.${index}.size`, "")
    setValue(`items.${index}.type`, "")
    setValue(`items.${index}.bf`, "")
    setValue(`items.${index}.quality`, "")

    const supabase = createClient()
    supabase
      .from("stock_entry_items")
      .select("reel_no, size, type, bf, quality, weight")
      .eq("gsm", gsmVal)
      .order("reel_no")
      .then(({ data }) => {
        setReelOptions(data ?? [])
        setLoadingReels(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsmVal])

  const handleReelSelect = (reel_no: string) => {
    const reel = reelOptions.find((r) => r.reel_no === reel_no)
    if (reel) {
      setValue(`items.${index}.reel_no`, reel_no)
      setValue(`items.${index}.size`, reel.size ?? "")
      setValue(`items.${index}.type`, reel.type ?? "")
      setValue(`items.${index}.bf`, reel.bf ?? "")
      setValue(`items.${index}.quality`, reel.quality ?? "")
      // Auto-fill weight from stock in record (complete stock in/out, no partials)
      if (reel.weight != null) {
        setValue(`items.${index}.weight`, reel.weight)
      }
    }
  }

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="border-b last:border-0"
    >
      {/* Serial No */}
      <td className="py-2 px-3 text-sm text-muted-foreground text-center w-10 shrink-0">
        {index + 1}
      </td>

      {/* GSM */}
      <td className="py-2 px-2">
        <Select
          value={gsmVal || ""}
          onValueChange={(v) => setValue(`items.${index}.gsm`, v)}
        >
          <SelectTrigger className="h-9 text-sm w-24">
            <SelectValue placeholder="GSM" />
          </SelectTrigger>
          <SelectContent>
            {settings.gsm_options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" {...register(`items.${index}.gsm`)} />
      </td>

      {/* Reel No — dropdown filtered by GSM */}
      <td className="py-2 px-2">
        <Select
          value={reelVal || ""}
          onValueChange={handleReelSelect}
          disabled={!gsmVal || loadingReels}
        >
          <SelectTrigger className="h-9 text-sm w-32">
            <SelectValue placeholder={
              !gsmVal ? "Select GSM first" :
              loadingReels ? "Loading..." :
              reelOptions.length === 0 ? "No reels" : "Reel #"
            } />
          </SelectTrigger>
          <SelectContent>
            {reelOptions.map((r) => (
              <SelectItem key={r.reel_no} value={r.reel_no}>{r.reel_no}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" {...register(`items.${index}.reel_no`)} />
      </td>

      {/* Size — auto-filled read-only */}
      <td className="py-2 px-2">
        <Input
          {...register(`items.${index}.size`)}
          readOnly
          className="h-9 text-sm w-20 bg-muted/50 cursor-default"
          placeholder="—"
        />
      </td>

      {/* Type — auto-filled read-only */}
      <td className="py-2 px-2">
        <Input
          {...register(`items.${index}.type`)}
          readOnly
          className="h-9 text-sm w-24 bg-muted/50 cursor-default"
          placeholder="—"
        />
      </td>

      {/* BF — auto-filled read-only */}
      <td className="py-2 px-2">
        <Input
          {...register(`items.${index}.bf`)}
          readOnly
          className="h-9 text-sm w-16 bg-muted/50 cursor-default"
          placeholder="—"
        />
      </td>

      {/* Quality — auto-filled read-only */}
      <td className="py-2 px-2">
        <Input
          {...register(`items.${index}.quality`)}
          readOnly
          className="h-9 text-sm w-24 bg-muted/50 cursor-default"
          placeholder="—"
        />
      </td>

      {/* Weight — auto-filled from stock in record, not editable (no partial weights) */}
      <td className="py-2 px-2">
        <Input
          {...register(`items.${index}.weight`, { valueAsNumber: true })}
          type="number"
          readOnly
          placeholder="—"
          className="h-9 text-sm w-24 bg-muted/50 cursor-default"
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onEnterKey() }
          }}
        />
      </td>

      {/* Delete */}
      <td className="py-2 px-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </motion.tr>
  )
}
