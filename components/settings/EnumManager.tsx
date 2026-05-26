"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/logger"

interface EnumCategory {
  key: string
  label: string
  description: string
  values: string[]
}

interface EnumManagerProps {
  categories: EnumCategory[]
}

export function EnumManager({ categories: initialCategories }: EnumManagerProps) {
  const [categories, setCategories] = useState(initialCategories)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [newValues, setNewValues] = useState<Record<string, string>>({})

  const addOption = async (key: string) => {
    const value = newValues[key]?.trim()
    if (!value) { toast.error("Please enter a value before adding."); return }

    const cat = categories.find((c) => c.key === key)!
    if (cat.values.map((v) => v.toLowerCase()).includes(value.toLowerCase())) {
      toast.error(`"${value}" already exists in this list.`)
      return
    }

    const updated = [...cat.values, value]
    await save(key, updated, `"${value}" added successfully`)
    setNewValues((p) => ({ ...p, [key]: "" }))
  }

  const removeOption = async (key: string, value: string) => {
    const cat = categories.find((c) => c.key === key)!
    const updated = cat.values.filter((v) => v !== value)
    await save(key, updated, `"${value}" removed`)
  }

  const save = async (key: string, values: string[], successMsg: string) => {
    setSavingKey(key)
    logger.info("Saving app_settings", { key, values })
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from("app_settings")
        .upsert({ setting_key: key, setting_values: values, updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: "setting_key" })

      if (error) {
        logger.error("Failed to save settings", error)
        toast.error("Failed to save changes. Please try again.")
        return
      }

      setCategories((prev) => prev.map((c) => c.key === key ? { ...c, values } : c))
      toast.success(successMsg)
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {categories.map((cat) => (
        <Card key={cat.key}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{cat.label}</CardTitle>
            <CardDescription className="text-xs">{cat.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current options */}
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              <AnimatePresence>
                {cat.values.map((value) => (
                  <motion.div
                    key={value}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Badge variant="secondary" className="gap-1.5 pr-1">
                      {value}
                      <button
                        onClick={() => removeOption(cat.key, value)}
                        disabled={savingKey === cat.key}
                        className="rounded-full hover:bg-muted p-0.5 transition-colors"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  </motion.div>
                ))}
              </AnimatePresence>
              {cat.values.length === 0 && (
                <p className="text-xs text-muted-foreground">No options yet.</p>
              )}
            </div>

            {/* Add new option */}
            <div className="flex gap-2">
              <Input
                placeholder={`Add new ${cat.label.toLowerCase()}...`}
                value={newValues[cat.key] ?? ""}
                onChange={(e) => setNewValues((p) => ({ ...p, [cat.key]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(cat.key) } }}
                className="h-8 text-sm"
                disabled={savingKey === cat.key}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => addOption(cat.key)}
                disabled={savingKey === cat.key}
                className="h-8 px-3 shrink-0"
              >
                {savingKey === cat.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
