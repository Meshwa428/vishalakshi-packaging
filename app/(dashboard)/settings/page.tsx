"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EnumManager } from "@/components/settings/EnumManager"
import { useProfileContext } from "@/components/shared/ProfileProvider"
import { useSettings } from "@/hooks/useSettings"
import { logger } from "@/lib/logger"

const DEFAULT_SETTINGS = {
  type_options: { label: "Type", description: "Options for the Type dropdown in stock entry forms" },
  gsm_options: { label: "GSM", description: "GSM value options" },
  bf_options: { label: "BF", description: "Burst Factor value options" },
  quality_options: { label: "Quality", description: "Quality grade options" },
}

export default function SettingsPage() {
  const router = useRouter()
  const { isAdmin, loading: profileLoading } = useProfileContext()
  const { settings, loading: settingsLoading } = useSettings()

  // Redirect non-admins once profile is loaded
  useEffect(() => {
    if (!profileLoading && !isAdmin) {
      logger.warn("Non-admin tried to access settings — redirecting")
      router.replace("/stock-entries")
    }
  }, [profileLoading, isAdmin, router])

  if (profileLoading || settingsLoading) {
    return <SettingsSkeleton />
  }

  if (!isAdmin) return null

  const categories = Object.entries(DEFAULT_SETTINGS).map(([key, meta]) => ({
    key,
    label: meta.label,
    description: meta.description,
    values: settings[key as keyof typeof settings] ?? [],
  }))

  logger.info("Settings page loaded")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage dropdown options used in stock entry forms. Changes take effect immediately."
      />
      <EnumManager categories={categories} />
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-24 rounded" />
        <Skeleton className="h-4 w-80 rounded" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-7 w-16 rounded-full" />
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
