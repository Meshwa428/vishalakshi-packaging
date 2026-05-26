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

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      setProfile(data)
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
