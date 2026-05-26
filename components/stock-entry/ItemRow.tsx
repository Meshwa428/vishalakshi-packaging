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
}

export function ItemRow({ index, settings, onRemove, canRemove, isReadOnly }: ItemRowProps) {
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
        <SelectTrigger className="h-9 text-sm">
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
