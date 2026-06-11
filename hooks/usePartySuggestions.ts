"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { AppSettings } from "@/types"

/**
 * Builds the party / supplier autocomplete list for the Stock In form.
 * Sources:
 *   1. Admin-managed suppliers list (app_settings → supplier_options)
 *   2. Distinct party names already used in past entries (auto-remembered)
 * Returns a de-duplicated, alphabetically sorted list.
 */
// Cached across mounts so opening the New Entry form repeatedly doesn't
// re-scan both entry tables each time.
let dbNamesCache: string[] | null = null

export function usePartySuggestions(settings: AppSettings) {
  const [dbNames, setDbNames] = useState<string[]>(dbNamesCache ?? [])

  useEffect(() => {
    if (dbNamesCache) return
    const supabase = createClient()
    Promise.all([
      supabase.from("stock_entries").select("party_name"),
      supabase.from("stock_out_entries").select("party_name"),
    ]).then(([stockIn, stockOut]) => {
      const rows = [
        ...((stockIn.data ?? []) as { party_name: string | null }[]),
        ...((stockOut.data ?? []) as { party_name: string | null }[]),
      ]
      const names = rows
        .map((r) => (r.party_name ?? "").trim())
        .filter(Boolean)
      dbNamesCache = names
      setDbNames(names)
    })
  }, [])

  const merged = new Map<string, string>() // lowercase → display value
  for (const name of [...(settings.supplier_options ?? []), ...dbNames]) {
    const key = name.toLowerCase()
    if (!merged.has(key)) merged.set(key, name)
  }
  return Array.from(merged.values()).sort((a, b) => a.localeCompare(b))
}
