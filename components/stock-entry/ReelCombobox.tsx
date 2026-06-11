"use client"

import { useEffect, useRef, useState } from "react"
import { Combobox } from "@base-ui/react/combobox"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

export interface ReelOption {
  reel_no: string
  size: string | null
  type: string | null
  bf: string | null
  quality: string | null
  weight: number | null
}

interface ReelComboboxProps {
  gsm: string
  value: string
  disabled?: boolean
  onSelect: (reel: ReelOption | null) => void
  className?: string
  inputClassName?: string
}

/**
 * Searchable reel-number picker. Instead of loading every reel into a dropdown
 * (which doesn't scale), it queries Supabase as the user types — scoped to the
 * selected GSM, capped at 50 results, debounced. Picking a reel returns its full
 * record so the form can auto-fill size/type/bf/quality/weight.
 */
export function ReelCombobox({ gsm, value, disabled, onSelect, className, inputClassName }: ReelComboboxProps) {
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<ReelOption[]>([])
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  // Debounced server search whenever GSM or the typed query changes.
  useEffect(() => {
    if (!gsm) { setOptions([]); return }
    const id = ++reqId.current
    setLoading(true)
    const handle = setTimeout(async () => {
      const supabase = createClient()
      let q = supabase
        .from("stock_entry_items")
        .select("reel_no, size, type, bf, quality, weight")
        .eq("gsm", gsm)
        .order("reel_no")
        .limit(50)
      const text = query.trim()
      if (text) q = q.ilike("reel_no", `%${text}%`)
      const { data } = await q
      if (id !== reqId.current) return // a newer request superseded this one
      setOptions((data ?? []) as ReelOption[])
      setLoading(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [gsm, query])

  const reelNos = options.map((o) => o.reel_no)

  return (
    <Combobox.Root
      items={reelNos}
      value={value || null}
      disabled={disabled}
      filter={null} /* filtering happens server-side */
      onInputValueChange={(v) => setQuery(v)}
      onValueChange={(v) => onSelect(options.find((o) => o.reel_no === v) ?? null)}
    >
      <Combobox.InputGroup className={cn("relative", className)}>
        <Combobox.Input
          placeholder={!gsm ? "Select GSM first" : "Search reel #"}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center rounded-lg border border-input bg-transparent py-2 pr-8 pl-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
            inputClassName
          )}
        />
        <Combobox.Trigger
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center disabled:opacity-50"
        >
          <Combobox.Icon render={<ChevronDownIcon className="size-4 text-muted-foreground" />} />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="isolate z-50" align="start">
          <Combobox.Popup className="max-h-72 w-(--anchor-width) min-w-40 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.Empty className="px-2.5 py-2 text-sm text-muted-foreground">
              {loading ? "Searching…" : !gsm ? "Select GSM first" : "No reels found"}
            </Combobox.Empty>
            <Combobox.List>
              {(reelNo: string) => (
                <Combobox.Item
                  key={reelNo}
                  value={reelNo}
                  className="relative flex w-full cursor-default items-center rounded-md py-1.5 px-2.5 text-sm font-mono outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-selected:bg-accent/60"
                >
                  {reelNo}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
