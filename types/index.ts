export type Role = 'admin' | 'operator'
export type EntryStatus = 'draft' | 'done'
export type EntryType = 'stock_in' | 'stock_out'

export interface Profile {
  id: string
  full_name: string
  role: Role
  created_at: string
}

// ─── Stock In ───────────────────────────────────────────────────────────────

export interface StockEntry {
  id: string
  invoice_number: string
  date: string
  truck_number: string | null
  party_name: string
  shipped_from: string | null
  delivery_address: string | null
  status: EntryStatus
  created_by: string
  created_at: string
  updated_at: string
  profiles?: Profile
  stock_entry_items?: StockEntryItem[]
}

export interface StockEntryItem {
  id: string
  stock_entry_id: string
  reel_no: string
  size: string | null
  type: string | null
  gsm: string | null
  bf: string | null
  quality: string | null
  weight: number | null
  created_at: string
}

// ─── Stock Out ──────────────────────────────────────────────────────────────

export interface StockOutEntry {
  id: string
  invoice_number: string
  date: string
  truck_number: string | null
  party_name: string
  shipped_from: string | null
  delivery_address: string | null
  status: EntryStatus
  created_by: string
  created_at: string
  updated_at: string
  profiles?: Profile
  stock_out_items?: StockOutItem[]
}

export interface StockOutItem {
  id: string
  stock_out_entry_id: string
  reel_no: string
  gsm: string | null
  size: string | null
  type: string | null
  bf: string | null
  quality: string | null
  weight: number | null
  created_at: string
}

// ─── Unified list entry (merges Stock In + Stock Out for the list view) ─────

export interface UnifiedListEntry {
  id: string
  invoice_number: string
  date: string
  truck_number: string | null
  party_name: string
  status: EntryStatus
  entry_type: EntryType
  items_count: number
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSetting {
  id: string
  setting_key: string
  setting_values: string[]
  updated_by: string | null
  updated_at: string
}

export interface AppSettings {
  type_options: string[]
  gsm_options: string[]
  bf_options: string[]
  quality_options: string[]
}

export type StockEntryItemInput = Omit<StockEntryItem, 'id' | 'stock_entry_id' | 'created_at'>

export interface StockEntryFormData {
  invoice_number: string
  date: string
  truck_number: string
  party_name: string
  shipped_from: string
  delivery_address: string
  items: StockEntryItemInput[]
}
