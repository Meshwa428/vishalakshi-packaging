"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, FormProvider, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AnimatePresence } from "framer-motion"
import { Plus, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ItemRow } from "@/components/stock-entry/ItemRow"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/logger"
import type { AppSettings, StockEntry, StockEntryItem } from "@/types"

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
}

const emptyItem = (): FormData["items"][0] => ({
  reel_no: "", size: "", type: "", gsm: "", bf: "", quality: "", weight: null,
})

export function EntryForm({ settings, existingEntry, isEdit }: EntryFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

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

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    logger.info("Submitting stock entry", { invoiceNo: data.invoice_number, isEdit })
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error("Session expired. Please sign in again."); return }

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
        const { error: itemsError } = await supabase.from("stock_entry_items").insert(
          data.items.map((item) => ({ ...item, stock_entry_id: existingEntry.id, weight: item.weight ?? null }))
        )

        if (itemsError) {
          logger.error("Failed to update stock entry items", itemsError)
          toast.error("Entry header saved but reel details failed. Please edit again.")
          return
        }

        logger.info("Stock entry updated", { id: existingEntry.id })
        toast.success("Stock entry updated successfully!")
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

        const { error: itemsError } = await supabase.from("stock_entry_items").insert(
          data.items.map((item) => ({ ...item, stock_entry_id: entry.id, weight: item.weight ?? null }))
        )

        if (itemsError) {
          logger.error("Failed to insert stock entry items", itemsError)
          // Rollback header
          await supabase.from("stock_entries").delete().eq("id", entry.id)
          if (itemsError.code === "23505") {
            toast.error("One or more reel numbers already exist in the system. Each reel number must be unique.")
          } else {
            toast.error("Failed to save reel details. Please try again.")
          }
          return
        }

        logger.info("Stock entry created", { id: entry.id })
        toast.success("Stock entry created successfully!")
        router.push("/stock-entries")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header details */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Entry Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number *</Label>
                <Input id="invoice_number" placeholder="INV-001" {...register("invoice_number")} />
                {errors.invoice_number && <p className="text-xs text-destructive">{errors.invoice_number.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" {...register("date")} />
                {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="truck_number">Truck Number</Label>
                <Input id="truck_number" placeholder="TN-1234" {...register("truck_number")} />
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
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Reel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            {errors.items && typeof errors.items === "object" && "message" in errors.items && (
              <p className="text-xs text-destructive px-4 py-2">{String(errors.items.message)}</p>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} className="cursor-pointer">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="gap-2 cursor-pointer">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? "Save Changes" : "Create Entry"}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
