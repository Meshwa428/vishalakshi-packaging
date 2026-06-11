import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileProvider } from "@/components/shared/ProfileProvider"
import { DashboardNav } from "@/components/shared/DashboardNav"
import { logger } from "@/lib/logger"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // Local JWT verification — the proxy already guards this route over the
  // network, so a second getUser() round-trip here just slows the first paint.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub ?? null

  if (!userId) {
    logger.info("Unauthenticated request — redirecting to login")
    redirect("/login")
  }

  logger.info("Dashboard layout — user authenticated", { userId })

  return (
    <ProfileProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <DashboardNav />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:py-8 md:pb-8">
          {children}
        </main>
      </div>
    </ProfileProvider>
  )
}
