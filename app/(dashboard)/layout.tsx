import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardNav } from "@/components/shared/DashboardNav"
import { logger } from "@/lib/logger"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    logger.info("Unauthenticated request — redirecting to login")
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) {
    logger.error("No profile found for user", { userId: user.id })
    redirect("/login")
  }

  logger.info("Dashboard loaded", { userId: user.id, role: profile.role })

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardNav profile={profile} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
