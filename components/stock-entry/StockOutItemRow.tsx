"use client"

import { useEffect, useRef } from "react"
import { Trash2 } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ReelCombobox, type ReelOption } from "@/components/stock-entry/ReelCombobox"
import type { AppSettings } from "@/types"

interface StockOutItemRowProps {
  index: number
  settings: AppSettings
  onRemove: () => void
  canRemove: boolean
  onEnterKey: () => void
  mobile?: boolean
}

export function StockOutItemRow({ index, settings, onRemove, canRemove, onEnterKey, mobile }: StockOutItemRowProps) {
  const { register, setValue, control } = useFormContext()

  const gsmVal = useWatch({ control, name: `items.${index}.gsm` })
  const reelVal = useWatch({ control, name: `items.${index}.reel_no` })
  const sizeVal = useWatch({ control, name: `items.${index}.size` })
  const typeVal = useWatch({ control, name: `items.${index}.type` })
  const bfVal = useWatch({ control, name: `items.${index}.bf` })
  const qualityVal = useWatch({ control, name: `items.${index}.quality` })
  const weightVal = useWatch({ control, name: `items.${index}.weight` })

  // Clear the reel + auto-filled fields when GSM *changes* (not on first mount,
  // so prefilled edit values survive).
  const prevGsm = useRef(gsmVal)
  useEffect(() => {
    if (prevGsm.current === gsmVal) return
    prevGsm.current = gsmVal
    setValue(`items.${index}.reel_no`, "")
    setValue(`items.${index}.size`, "")
    setValue(`items.${index}.type`, "")
    setValue(`items.${index}.bf`, "")
    setValue(`items.${index}.quality`, "")
    setValue(`items.${index}.weight`, null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsmVal])

  const handleReelSelect = (reel: ReelOption | null) => {
    setValue(`items.${index}.reel_no`, reel?.reel_no ?? "")
    setValue(`items.${index}.size`, reel?.size ?? "")
    setValue(`items.${index}.type`, reel?.type ?? "")
    setValue(`items.${index}.bf`, reel?.bf ?? "")
    setValue(`items.${index}.quality`, reel?.quality ?? "")
    // Auto-fill weight from the stock-in record (complete in/out, no partials)
    setValue(`items.${index}.weight`, reel?.weight ?? null)
  }

  // ── Mobile card layout ──────────────────────────────────────────
  if (mobile) {
    const num = String(index + 1).padStart(2, "0")
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-foreground text-background text-[11px] font-bold tabular-nums shrink-0">
              {num}
            </span>
            <span className="text-sm font-semibold tracking-tight">Reel #{index + 1}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={!canRemove}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* GSM — full width first, most important selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              GSM <span className="text-destructive">*</span>
            </label>
            <Select value={gsmVal || ""} onValueChange={(v) => setValue(`items.${index}.gsm`, v)}>
              <SelectTrigger className="h-11 text-sm">
                <SelectValue placeholder="Select GSM" />
              </SelectTrigger>
              <SelectContent>
                {settings.gsm_options.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register(`items.${index}.gsm`)} />
          </div>

          {/* Reel No — searchable, enabled only after GSM selected */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Reel No <span className="text-destructive">*</span>
            </label>
            <ReelCombobox
              gsm={gsmVal}
              value={reelVal || ""}
              disabled={!gsmVal}
              onSelect={handleReelSelect}
              inputClassName="h-11"
            />
            <input type="hidden" {...register(`items.${index}.reel_no`)} />
          </div>

          {/* Auto-filled details — shown as a filled summary card once reel is chosen */}
          {reelVal ? (
            <div className="rounded-lg bg-muted/50 border divide-y text-sm">
              <div className="grid grid-cols-2 divide-x">
                {[["Size", sizeVal], ["Type", typeVal]].map(([label, val]) => (
                  <div key={label as string} className="px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">{label}</p>
                    <p className="font-medium">{(val as string) || "—"}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 divide-x">
                {[["BF", bfVal], ["Quality", qualityVal]].map(([label, val]) => (
                  <div key={label as string} className="px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">{label}</p>
                    <p className="font-medium">{(val as string) || "—"}</p>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Weight</p>
                <p className="font-semibold font-mono tabular-nums">{weightVal != null ? `${weightVal} kg` : "—"}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic text-center py-1">
              Select GSM & Reel No to auto-fill details
            </p>
          )}
        </div>

        {/* Hidden inputs for form values */}
        <input type="hidden" {...register(`items.${index}.size`)} />
        <input type="hidden" {...register(`items.${index}.type`)} />
        <input type="hidden" {...register(`items.${index}.bf`)} />
        <input type="hidden" {...register(`items.${index}.quality`)} />
        <input type="hidden" {...register(`items.${index}.weight`, { valueAsNumber: true })} />
      </div>
    )
  }

  // ── Desktop table row ────────────────────────────────────────────
  return (
    <tr className="border-b last:border-0">
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

      {/* Reel No — searchable, filtered by GSM */}
      <td className="py-2 px-2">
        <ReelCombobox
          gsm={gsmVal}
          value={reelVal || ""}
          disabled={!gsmVal}
          onSelect={handleReelSelect}
          className="w-36"
        />
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
    </tr>
  )
}
