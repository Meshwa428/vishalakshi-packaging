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

const formSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required"),
  date: z.string().min(1, "Date is required"),
  truck_number: z.string(),
  party_name: z.string().min(1, "Party name is required"),
  shipped_from: z.string(),
  delivery_address: z.string(),
  items: z.array(stockOutItemSchema).min(1, "At least one reel entry is required"),
})

type FormData = z.infer<typeof formSchema>

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

export function StockOutForm({ settings, existingEntry, isEdit, resetSignal }: StockOutFormProps) {
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
    logger.info("Submitting stock out entry", { invoiceNo: data.invoice_number, status })
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error("Session expired. Please sign in again."); return }

      // For drafts, filter out incomplete reel rows
      const effectiveItems = status === "draft"
        ? (data.items ?? []).filter(item => item.reel_no?.trim())
        : data.items

      // Cross-table invoice uniqueness check
      // Skip if editing and the invoice number hasn't changed
      const invoiceChanged = !isEdit || (existingEntry && existingEntry.invoice_number !== data.invoice_number)
      if (invoiceChanged) {
        const { count: inCount } = await supabase
          .from("stock_entries")
          .select("id", { count: "exact", head: true })
          .eq("invoice_number", data.invoice_number)
        if ((inCount ?? 0) > 0) {
          toast.error(`Invoice number "${data.invoice_number}" already exists in a Stock In entry.`)
          setLoading(null)
          return
        }
      }

      if (isEdit && existingEntry) {
        const { error: headerError } = await supabase
          .from("stock_out_entries")
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
        const { data: entry, error: headerError } = await supabase
          .from("stock_out_entries")
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
          logger.error("Failed to create stock out entry", headerError)
          if (headerError?.code === "23505") {
            toast.error(`Invoice number "${data.invoice_number}" already exists.`)
          } else {
            toast.error("Failed to create entry. Please try again.")
          }
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
            <div className="relative">
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
                  <AnimatePresence initial={false}>
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
                  </AnimatePresence>
                  <TotalsRow control={control} />
                </tbody>
              </table>
              </div>
              {/* Scroll hint gradient — mobile only */}
              <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden rounded-r-lg" />
            </div>
            {errors.items && typeof errors.items === "object" && "message" in errors.items && (
              <p className="text-xs text-destructive px-4 py-2">{String(errors.items.message)}</p>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading !== null} className="cursor-pointer">
            Cancel
          </Button>
          {(!isEdit || isDraftEntry) && (
            <Button type="button" variant="outline" onClick={() => {
              const values = methods.getValues()
              if (!values.invoice_number?.trim()) {
                toast.error("Invoice number is required to save as draft.")
                return
              }
              onSubmit(values, "draft")
            }} disabled={loading !== null} className="gap-2 cursor-pointer">
              {loading === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Save as Draft
            </Button>
          )}
          <Button type="button" onClick={() => handleSubmit((data) => onSubmit(data, "done"))()} disabled={loading !== null} className="gap-2 cursor-pointer">
            {loading === "done" ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit && isDraftEntry ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isEdit ? isDraftEntry ? "Submit Entry" : "Save Changes" : "Create Entry"}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
