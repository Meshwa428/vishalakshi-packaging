"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, FormProvider, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AnimatePresence } from "framer-motion"
import { Plus, Loader2, Save, FileText, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ItemRow } from "@/components/stock-entry/ItemRow"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/logger"
import type { AppSettings, StockEntry, StockEntryItem, EntryStatus } from "@/types"

const itemSchema = z.object({
  reel_no: z.string().min(1, "Reel number is required"),
  size: z.string(),
  type: z.string(),
  gsm: z.string(),
  bf: z.string(),
  quality: z.string(),
  weight: z.number().nullable().optional(),
})

const formSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required"),
  date: z.string().min(1, "Date is required"),
  truck_number: z.string(),
  party_name: z.string().min(1, "Party name is required"),
  shipped_from: z.string(),
  delivery_address: z.string(),
  items: z.array(itemSchema).min(1, "At least one reel entry is required"),
})

type FormData = z.infer<typeof formSchema>

interface EntryFormProps {
  settings: AppSettings
  existingEntry?: StockEntry & { stock_entry_items: StockEntryItem[] }
  isEdit?: boolean
  resetSignal?: number
}

const emptyItem = (): FormData["items"][0] => ({
  reel_no: "", size: "", type: "", gsm: "", bf: "", quality: "", weight: null,
})

function TotalsRow({ control }: { control: ReturnType<typeof useForm<FormData>>["control"] }) {
  const items = useWatch({ control, name: "items" }) ?? []
  const totalWeight = items.reduce((sum, item) => sum + (Number(item?.weight) || 0), 0)
  return (
    <tr className="border-t bg-muted/30">
      <td className="py-2.5 px-2 text-xs font-medium text-muted-foreground" colSpan={2}>Total</td>
      <td className="py-2.5 px-2 text-xs font-medium" colSpan={4}>{items.length} reel{items.length !== 1 ? "s" : ""}</td>
      <td className="py-2.5 px-2 text-xs font-medium">{totalWeight.toFixed(2)} kg</td>
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

export function EntryForm({ settings, existingEntry, isEdit, resetSignal }: EntryFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<"draft" | "done" | null>(null)

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: existingEntry ? {
      invoice_number: existingEntry.invoice_number,
      date: existingEntry.date,
      truck_number: existingEntry.truck_number ?? "",
      party_name: existingEntry.party_name,
      shipped_from: existingEntry.shipped_from ?? "",
      delivery_address: existingEntry.delivery_address ?? "",
      items: existingEntry.stock_entry_items.map((i) => ({
        reel_no: i.reel_no,
        size: i.size ?? "",
        type: i.type ?? "",
        gsm: i.gsm ?? "",
        bf: i.bf ?? "",
        quality: i.quality ?? "",
        weight: i.weight,
      })),
    } : {
      invoice_number: "",
      date: new Date().toISOString().split("T")[0],
      truck_number: "",
      party_name: "",
      shipped_from: "",
      delivery_address: "",
      items: [emptyItem()],
    },
  })

  const { register, control, handleSubmit, formState: { errors } } = methods
  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  // Reset form when resetSignal increments (triggered by Reset button in parent)
  useEffect(() => {
    if (!resetSignal) return
    methods.reset({
      invoice_number: "",
      date: new Date().toISOString().split("T")[0],
      truck_number: "",
      party_name: "",
      shipped_from: "",
      delivery_address: "",
      items: [emptyItem()],
    })
  }, [resetSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: FormData, status: EntryStatus) => {
    setLoading(status)
    logger.info("Submitting stock entry", { invoiceNo: data.invoice_number, status, isEdit })
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error("Session expired. Please sign in again."); return }

      // For drafts, filter out incomplete reel rows (empty reel_no) — allows partial saves
      const effectiveItems = status === "draft"
        ? (data.items ?? []).filter(item => item.reel_no?.trim())
        : data.items

      // Cross-table invoice uniqueness check
      // Skip if editing and the invoice number hasn't changed
      const invoiceChanged = !isEdit || (existingEntry && existingEntry.invoice_number !== data.invoice_number)
      if (invoiceChanged) {
        const { count: outCount } = await supabase
          .from("stock_out_entries")
          .select("id", { count: "exact", head: true })
          .eq("invoice_number", data.invoice_number)
        if ((outCount ?? 0) > 0) {
          toast.error(`Invoice number "${data.invoice_number}" already exists in a Stock Out entry.`)
          setLoading(null)
          return
        }
      }

      // Pre-check reel_no uniqueness before any DB write
      // For edit: only check reel_nos that are NEW (not in the original entry)
      const submittedReelNos = effectiveItems.map((i) => i.reel_no).filter(Boolean)
      const originalReelNos = new Set(existingEntry?.stock_entry_items?.map((i) => i.reel_no) ?? [])
      const reelNosToCheck = isEdit
        ? submittedReelNos.filter((r) => !originalReelNos.has(r))
        : submittedReelNos
      if (reelNosToCheck.length > 0) {
        const { data: dupeReels } = await supabase
          .from("stock_entry_items")
          .select("reel_no")
          .in("reel_no", reelNosToCheck)
        if (dupeReels && dupeReels.length > 0) {
          const dupeList = dupeReels.map((r) => r.reel_no).join(", ")
          toast.error(`Reel number(s) already exist in another entry: ${dupeList}`)
          setLoading(null)
          return
        }
      }

      if (isEdit && existingEntry) {
        // Update header
        const { error: headerError } = await supabase
          .from("stock_entries")
          .update({
            invoice_number: data.invoice_number,
            date: data.date,
            truck_number: data.truck_number || null,
            party_name: data.party_name,
            shipped_from: data.shipped_from || null,
            delivery_address: data.delivery_address || null,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingEntry.id)

        if (headerError) {
          logger.error("Failed to update stock entry header", headerError)
          toast.error("Failed to save changes. Please try again.")
          return
        }

        // Delete old items and re-insert
        await supabase.from("stock_entry_items").delete().eq("stock_entry_id", existingEntry.id)
        const { error: itemsError } = effectiveItems.length > 0
          ? await supabase.from("stock_entry_items").insert(
              effectiveItems.map((item) => ({ ...item, stock_entry_id: existingEntry.id, weight: item.weight ?? null }))
            )
          : { error: null }

        if (itemsError) {
          logger.error("Failed to update stock entry items", itemsError)
          toast.error("Entry header saved but reel details failed. Please edit again.")
          return
        }

        logger.info("Stock entry updated", { id: existingEntry.id, status })
        toast.success(status === "done" ? "Entry submitted successfully!" : "Draft saved successfully!")
        router.push(`/stock-entries/${existingEntry.id}`)
      } else {
        // Create new entry
        const { data: entry, error: headerError } = await supabase
          .from("stock_entries")
          .insert({
            invoice_number: data.invoice_number,
            date: data.date,
            truck_number: data.truck_number || null,
            party_name: data.party_name,
            shipped_from: data.shipped_from || null,
            delivery_address: data.delivery_address || null,
            status,
            created_by: user.id,
          })
          .select()
          .single()

        if (headerError || !entry) {
          logger.error("Failed to create stock entry", headerError)
          if (headerError?.code === "23505") {
            toast.error(`Invoice number "${data.invoice_number}" already exists. Please use a unique invoice number.`)
          } else {
            toast.error("Failed to create entry. Please try again.")
          }
          return
        }

        const { error: itemsError } = effectiveItems.length > 0
          ? await supabase.from("stock_entry_items").insert(
              effectiveItems.map((item) => ({ ...item, stock_entry_id: entry.id, weight: item.weight ?? null }))
            )
          : { error: null }

        if (itemsError) {
          logger.error("Failed to insert stock entry items", itemsError)
          await supabase.from("stock_entries").delete().eq("id", entry.id)
          toast.error("Failed to save reel details. Please try again.")
          return
        }

        logger.info("Stock entry created", { id: entry.id, status })
        toast.success(status === "done" ? "Stock entry created successfully!" : "Draft saved! You can complete it later.")
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
        {/* Header details */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Entry Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number *</Label>
                <Input id="invoice_number" placeholder="001" {...register("invoice_number")} />
                {errors.invoice_number && <p className="text-xs text-destructive">{errors.invoice_number.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" {...register("date")} />
                {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="truck_number">Truck Number</Label>
                <Input id="truck_number" placeholder="GJ 18 VA 5423" {...register("truck_number")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="party_name">Party Name *</Label>
                <Input id="party_name" placeholder="Customer / Supplier name" {...register("party_name")} />
                {errors.party_name && <p className="text-xs text-destructive">{errors.party_name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="shipped_from">Shipped From</Label>
                <Input id="shipped_from" placeholder="Origin location" {...register("shipped_from")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_address">Delivery Address</Label>
                <Input id="delivery_address" placeholder="Delivery location" {...register("delivery_address")} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reel Items */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Reel Details</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append(emptyItem())}
                className="gap-1.5 h-9"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Reel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* ── Mobile card list (sm and below) ── */}
            <div className="sm:hidden p-3 space-y-3">
              <AnimatePresence initial={false}>
                {fields.map((field, index) => (
                  <ItemRow
                    key={field.id}
                    mobile
                    index={index}
                    settings={settings}
                    onRemove={() => remove(index)}
                    canRemove={fields.length > 1}
                    onEnterKey={() => append(emptyItem())}
                  />
                ))}
              </AnimatePresence>

              {/* Inline "Add Reel" — below last card, easy thumb reach */}
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
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">Reel No *</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">Size</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">Type</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">GSM</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">BF</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">Quality</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2.5 px-2">Weight (kg)</th>
                    <th className="py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {fields.map((field, index) => (
                      <ItemRow
                        key={field.id}
                        index={index}
                        settings={settings}
                        onRemove={() => remove(index)}
                        canRemove={fields.length > 1}
                        onEnterKey={() => append(emptyItem())}
                      />
                    ))}
                  </AnimatePresence>
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            className="cursor-pointer text-muted-foreground h-11 sm:h-9"
            disabled={loading !== null}
          >
            Cancel
          </Button>

          {/* Save as Draft — bypasses RHF validation so partial entries can be saved */}
          {(!isEdit || isDraftEntry) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const values = methods.getValues()
                if (!values.invoice_number?.trim()) {
                  toast.error("Invoice number is required to save as draft.")
                  return
                }
                onSubmit(values, "draft")
              }}
              disabled={loading !== null}
              className="gap-2 cursor-pointer h-11 sm:h-9"
            >
              {loading === "draft" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Save as Draft
            </Button>
          )}

          {/* Submit / Create Entry */}
          <Button
            type="button"
            onClick={() => handleSubmit((data) => onSubmit(data, "done"))()}
            disabled={loading !== null}
            className="gap-2 cursor-pointer h-11 sm:h-9 text-base sm:text-sm font-semibold sm:font-medium"
          >
            {loading === "done" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit && isDraftEntry ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEdit
              ? isDraftEntry
                ? "Submit Entry"
                : "Save Changes"
              : "Create Entry"}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
