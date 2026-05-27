"use client"

import { motion } from "framer-motion"
import { Trash2 } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { AppSettings } from "@/types"

interface ItemRowProps {
  index: number
  settings: AppSettings
  onRemove: () => void
  canRemove: boolean
  isReadOnly?: boolean
  onEnterKey?: () => void
  mobile?: boolean
}

export function ItemRow({ index, settings, onRemove, canRemove, isReadOnly, onEnterKey, mobile }: ItemRowProps) {
  const { register, setValue, control, formState: { errors } } = useFormContext()

  // All watches at top level — Rules of Hooks compliant
  const typeVal = useWatch({ control, name: `items.${index}.type` })
  const gsmVal = useWatch({ control, name: `items.${index}.gsm` })
  const bfVal = useWatch({ control, name: `items.${index}.bf` })
  const qualityVal = useWatch({ control, name: `items.${index}.quality` })
  const reelNoVal = useWatch({ control, name: `items.${index}.reel_no` })
  const sizeVal = useWatch({ control, name: `items.${index}.size` })
  const weightVal = useWatch({ control, name: `items.${index}.weight` })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemErrors = ((errors.items as any)?.[index] ?? {}) as Record<string, { message?: string }>

  const SelectField = ({
    value,
    fieldName,
    options,
    placeholder,
  }: {
    value: string
    fieldName: string
    options: string[]
    placeholder: string
  }) => {
    if (isReadOnly) {
      return <span className="text-sm py-2 block">{value || <span className="text-muted-foreground">—</span>}</span>
    }
    return (
      <Select value={value ?? ""} onValueChange={(v) => setValue(`items.${index}.${fieldName}`, v)}>
        <SelectTrigger className="h-11 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // ── Mobile card layout ──────────────────────────────────────────
  if (mobile) {
    const num = String(index + 1).padStart(2, "0")
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="rounded-xl border bg-card overflow-hidden"
      >
        {/* Card header — accent bar + number badge */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-foreground text-background text-[11px] font-bold tabular-nums shrink-0">
              {num}
            </span>
            <span className="text-sm font-semibold tracking-tight">Reel #{index + 1}</span>
          </div>
          {!isReadOnly && (
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
          )}
        </div>

        {/* Fields */}
        <div className="p-4 space-y-4">
          {/* Reel No — full width, most prominent */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Reel No <span className="text-destructive">*</span>
            </label>
            {isReadOnly ? (
              <p className="text-base font-mono font-semibold py-1">{reelNoVal || "—"}</p>
            ) : (
              <>
                <Input
                  {...register(`items.${index}.reel_no`)}
                  placeholder="Enter reel number"
                  className="h-11 text-base font-mono"
                  autoComplete="off"
                />
                {itemErrors?.reel_no && (
                  <p className="text-xs text-destructive">{itemErrors.reel_no.message}</p>
                )}
              </>
            )}
          </div>

          {/* Row: Size + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Size</label>
              {isReadOnly ? (
                <p className="text-sm py-1">{sizeVal || "—"}</p>
              ) : (
                <Input {...register(`items.${index}.size`)} placeholder="e.g. 40" className="h-11 text-sm" />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Type</label>
              <SelectField value={typeVal} fieldName="type" options={settings.type_options} placeholder="Select" />
            </div>
          </div>

          {/* Row: GSM + BF */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">GSM</label>
              <SelectField value={gsmVal} fieldName="gsm" options={settings.gsm_options} placeholder="Select" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">BF</label>
              <SelectField value={bfVal} fieldName="bf" options={settings.bf_options} placeholder="Select" />
            </div>
          </div>

          {/* Row: Quality + Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Quality</label>
              <SelectField value={qualityVal} fieldName="quality" options={settings.quality_options} placeholder="Select" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Weight (kg)</label>
              {isReadOnly ? (
                <p className="text-sm py-1 font-mono">{weightVal ?? "—"}</p>
              ) : (
                <Input
                  {...register(`items.${index}.weight`, { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="h-11 text-sm font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); onEnterKey?.() }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Desktop table row ────────────────────────────────────────────
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
    >
      {/* Reel No */}
      <td className="py-2 px-2 min-w-[110px]">
        {isReadOnly ? (
          <span className="text-sm font-mono">{reelNoVal}</span>
        ) : (
          <div>
            <Input
              {...register(`items.${index}.reel_no`)}
              placeholder="Reel #"
              className="h-9 text-sm font-mono"
            />
            {itemErrors?.reel_no && (
              <p className="text-xs text-destructive mt-0.5">{itemErrors.reel_no.message}</p>
            )}
          </div>
        )}
      </td>

      {/* Size */}
      <td className="py-2 px-2 min-w-[90px]">
        {isReadOnly ? (
          <span className="text-sm">{sizeVal || "—"}</span>
        ) : (
          <Input {...register(`items.${index}.size`)} placeholder="40" className="h-9 text-sm" />
        )}
      </td>

      {/* Type */}
      <td className="py-2 px-2 min-w-[120px]">
        <SelectField value={typeVal} fieldName="type" options={settings.type_options} placeholder="Type" />
      </td>

      {/* GSM */}
      <td className="py-2 px-2 min-w-[90px]">
        <SelectField value={gsmVal} fieldName="gsm" options={settings.gsm_options} placeholder="GSM" />
      </td>

      {/* BF */}
      <td className="py-2 px-2 min-w-[90px]">
        <SelectField value={bfVal} fieldName="bf" options={settings.bf_options} placeholder="BF" />
      </td>

      {/* Quality */}
      <td className="py-2 px-2 min-w-[120px]">
        <SelectField value={qualityVal} fieldName="quality" options={settings.quality_options} placeholder="Quality" />
      </td>

      {/* Weight */}
      <td className="py-2 px-2 min-w-[100px]">
        {isReadOnly ? (
          <span className="text-sm">{weightVal ?? "—"}</span>
        ) : (
          <Input
            {...register(`items.${index}.weight`, { valueAsNumber: true })}
            type="number"
            step="0.01"
            placeholder="kg"
            className="h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); onEnterKey?.() }
            }}
          />
        )}
      </td>

      {/* Remove */}
      {!isReadOnly && (
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
      )}
    </motion.tr>
  )
}
