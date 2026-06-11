"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/types"

interface ProfileContextValue {
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  isAdmin: false,
})

// Cached across remounts so the role is available instantly and we don't
// re-query profiles on every full page load.
let profileCache: Profile | null = null

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(profileCache)
  const [loading, setLoading] = useState(!profileCache)

  useEffect(() => {
    const supabase = createClient()
    // getClaims() reads the user id from the locally-verified JWT — no network
    // call just to learn who we are before fetching the profile row.
    supabase.auth.getClaims().then(async ({ data }) => {
      const userId = data?.claims?.sub ?? null
      if (!userId) { setLoading(false); return }
      const { data: row } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()
      profileCache = row
      setProfile(row)
      setLoading(false)
    })
  }, [])

  return (
    <ProfileContext.Provider value={{ profile, loading, isAdmin: profile?.role === "admin" }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfileContext() {
  return useContext(ProfileContext)
}
