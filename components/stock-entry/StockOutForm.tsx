"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, FormProvider, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Loader2, Save, FileText, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { StockOutItemRow } from "@/components/stock-entry/StockOutItemRow"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/logger"
import type { AppSettings, StockOutEntry, StockOutItem, EntryStatus } from "@/types"

const stockOutItemSchema = z.object({
  gsm: z.string().min(1, "GSM is required"),
  reel_no: z.string().min(1, "Reel number is required"),
  size: z.string(),
  type: z.string(),
  bf: z.string(),
  quality: z.string(),
  weight: z.number().nullable().optional(),
})

// Stock Out only collects the date manually — the rest (reel details) comes
// from the selected Stock In reel, and the invoice number is auto-generated.
const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  items: z.array(stockOutItemSchema).min(1, "At least one reel entry is required"),
})

type FormData = z.infer<typeof formSchema>

// Generates the next sequential Stock Out reference, e.g. "SO-0001".
// The SO- prefix keeps these globally unique vs. Stock In invoice numbers.
async function generateStockOutInvoice(
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const { data } = await supabase.from("stock_out_entries").select("invoice_number")
  let max = 0
  for (const row of data ?? []) {
    const m = /^SO-(\d+)$/.exec(row.invoice_number ?? "")
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `SO-${String(max + 1).padStart(4, "0")}`
}

interface StockOutFormProps {
  settings: AppSettings
  existingEntry?: StockOutEntry & { stock_out_items: StockOutItem[] }
  isEdit?: boolean
  resetSignal?: number
}

const emptyItem = (): FormData["items"][0] => ({
  gsm: "", reel_no: "", size: "", type: "", bf: "", quality: "", weight: null,
})

function TotalsRow({ control }: { control: ReturnType<typeof useForm<FormData>>["control"] }) {
  const items = useWatch({ control, name: "items" }) ?? []
  const totalWeight = items.reduce((sum, item) => sum + (Number(item?.weight) || 0), 0)
  return (
    <tr className="border-t bg-muted/30">
      <td className="py-2.5 px-3 text-xs font-medium text-muted-foreground" colSpan={2}>
        Total
      </td>
      <td className="py-2.5 px-2 text-xs font-medium" colSpan={5}>
        {items.length} reel{items.length !== 1 ? "s" : ""}
      </td>
      <td className="py-2.5 px-2 text-xs font-medium">
        {totalWeight.toFixed(2)} kg
      </td>
      <td />
    </tr>
  )
}

function MobileTotals({ control }: { control: ReturnType<typeof useForm<FormData>>["control"] }) {
  const items = useWatch({ control, name: "items" }) ?? []
  const totalWeight = items.reduce((sum, item) => sum + (Number(item?.weight) || 0), 0)
  return (
    <span className="text-sm font-semibold tabular-nums">
      {items.length} reel{items.length !== 1 ? "s" : ""}
      <span className="text-muted-foreground font-normal mx-1.5">·</span>
      {totalWeight.toFixed(2)} kg
    </span>
  )
}

export function StockOutForm({ settings, existingEntry, isEdit, resetSignal }: StockOutFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<"draft" | "done" | null>(null)

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: existingEntry ? {
      date: existingEntry.date,
      items: existingEntry.stock_out_items.map((i) => ({
        gsm: i.gsm ?? "",
        reel_no: i.reel_no,
        size: i.size ?? "",
        type: i.type ?? "",
        bf: i.bf ?? "",
        quality: i.quality ?? "",
        weight: i.weight,
      })),
    } : {
      date: new Date().toISOString().split("T")[0],
      items: [emptyItem()],
    },
  })

  const { register, control, handleSubmit, formState: { errors } } = methods
  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  // Reset form when resetSignal increments (triggered by Reset button in parent)
  useEffect(() => {
    if (!resetSignal) return
    methods.reset({
      date: new Date().toISOString().split("T")[0],
      items: [emptyItem()],
    })
  }, [resetSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: FormData, status: EntryStatus) => {
    setLoading(status)
    logger.info("Submitting stock out entry", { status, isEdit })
    try {
      const supabase = createClient()
      const { data: claimsData } = await supabase.auth.getClaims()
      const userId = claimsData?.claims?.sub ?? null
      if (!userId) { toast.error("Session expired. Please sign in again."); return }

      // For drafts, filter out incomplete reel rows
      const effectiveItems = status === "draft"
        ? (data.items ?? []).filter(item => item.reel_no?.trim())
        : data.items

      if (isEdit && existingEntry) {
        // Only the date and reel list are editable now — invoice number and any
        // legacy header fields are preserved untouched.
        const { error: headerError } = await supabase
          .from("stock_out_entries")
          .update({
            date: data.date,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingEntry.id)

        if (headerError) {
          logger.error("Failed to update stock out entry", headerError)
          toast.error("Failed to save changes. Please try again.")
          return
        }

        await supabase.from("stock_out_items").delete().eq("stock_out_entry_id", existingEntry.id)
        const { error: itemsError } = effectiveItems.length > 0
          ? await supabase.from("stock_out_items").insert(
              effectiveItems.map((item) => ({ ...item, stock_out_entry_id: existingEntry.id, weight: item.weight ?? null }))
            )
          : { error: null }
        if (itemsError) {
          logger.error("Failed to update stock out items", itemsError)
          toast.error("Entry saved but reel details failed. Please edit again.")
          return
        }

        toast.success(status === "done" ? "Stock Out entry updated!" : "Draft saved!")
        router.push(`/stock-entries/${existingEntry.id}?type=stock_out`)
      } else {
        // Auto-generate the invoice number; retry on the rare collision when two
        // entries are created at the same instant (unique constraint hit).
        let entry: { id: string } | null = null
        let headerError: { code?: string } | null = null
        for (let attempt = 0; attempt < 5; attempt++) {
          const invoice_number = await generateStockOutInvoice(supabase)
          const res = await supabase
            .from("stock_out_entries")
            .insert({
              invoice_number,
              date: data.date,
              party_name: null,
              status,
              created_by: userId,
            })
            .select()
            .single()
          if (res.error?.code === "23505") { headerError = res.error; continue }
          entry = res.data
          headerError = res.error
          break
        }

        if (headerError || !entry) {
          logger.error("Failed to create stock out entry", headerError)
          toast.error("Failed to create entry. Please try again.")
          return
        }

        const { error: itemsError } = effectiveItems.length > 0
          ? await supabase.from("stock_out_items").insert(
              effectiveItems.map((item) => ({ ...item, stock_out_entry_id: entry.id, weight: item.weight ?? null }))
            )
          : { error: null }
        if (itemsError) {
          await supabase.from("stock_out_entries").delete().eq("id", entry.id)
          toast.error("Failed to save reel details. Please try again.")
          return
        }

        toast.success(status === "done" ? "Stock Out entry created!" : "Draft saved! Complete it later.")
        router.push("/stock-entries")
      }
    } finally {
      setLoading(null)
    }
  }

  const isDraftEntry = existingEntry?.status === "draft"

  return (
    <FormProvider {...methods}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Entry Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" {...register("date")} />
                {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
              </div>
              {isEdit && existingEntry && (
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">Invoice Number</Label>
                  <Input id="invoice_number" value={existingEntry.invoice_number} readOnly className="bg-muted/50 cursor-default font-mono" />
                </div>
              )}
            </div>
            {!isEdit && (
              <p className="text-xs text-muted-foreground mt-3">
                Invoice number is assigned automatically. All reel details are pulled from the selected stock — just pick the GSM and reel number below.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Reel Details</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => append(emptyItem())} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />Add Reel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* ── Mobile card list (sm and below) ── */}
            <div className="sm:hidden p-3 space-y-3">
                {fields.map((field, index) => (
                  <StockOutItemRow
                    key={field.id}
                    mobile
                    index={index}
                    settings={settings}
                    onRemove={() => remove(index)}
                    canRemove={fields.length > 1}
                    onEnterKey={() => append(emptyItem())}
                  />
                ))}

              {/* Inline "Add Reel" — below last card */}
              <button
                type="button"
                onClick={() => append(emptyItem())}
                className="w-full h-12 rounded-xl border-2 border-dashed border-border hover:border-foreground/30 hover:bg-muted/40 transition-colors flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Add Another Reel
              </button>

              {/* Mobile totals bar */}
              <div className="flex items-center justify-between px-1 py-2 border-t">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Total</span>
                <MobileTotals control={control} />
              </div>
            </div>

            {/* ── Desktop table (sm+) ── */}
            <div className="hidden sm:block relative">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-3 w-10">#</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">GSM *</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">Reel No *</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">Size</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">Type</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">BF</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">Quality</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">Weight (kg)</th>
                    <th className="py-2.5 px-2" />
                  </tr>
                </thead>
                <tbody>
                    {fields.map((field, index) => (
                      <StockOutItemRow
                        key={field.id}
                        index={index}
                        settings={settings}
                        onRemove={() => remove(index)}
                        canRemove={fields.length > 1}
                        onEnterKey={() => append(emptyItem())}
                      />
                    ))}
                  <TotalsRow control={control} />
                </tbody>
              </table>
              </div>
            </div>

            {errors.items && typeof errors.items === "object" && "message" in errors.items && (
              <p className="text-xs text-destructive px-4 py-2">{String(errors.items.message)}</p>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading !== null} className="cursor-pointer text-muted-foreground h-11 sm:h-9">
            Cancel
          </Button>
          {(!isEdit || isDraftEntry) && (
            <Button type="button" variant="outline" onClick={() => {
              const values = methods.getValues()
              if (!values.date?.trim()) {
                toast.error("Date is required to save as draft.")
                return
              }
              onSubmit(values, "draft")
            }} disabled={loading !== null} className="gap-2 cursor-pointer h-11 sm:h-9">
              {loading === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Save as Draft
            </Button>
          )}
          <Button type="button" onClick={() => handleSubmit((data) => onSubmit(data, "done"))()} disabled={loading !== null} className="gap-2 cursor-pointer h-11 sm:h-9 text-base sm:text-sm font-semibold sm:font-medium">
            {loading === "done" ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit && isDraftEntry ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isEdit ? isDraftEntry ? "Submit Entry" : "Save Changes" : "Create Entry"}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
