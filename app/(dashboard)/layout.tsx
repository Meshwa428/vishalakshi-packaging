import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileProvider } from "@/components/shared/ProfileProvider"
import { DashboardNav } from "@/components/shared/DashboardNav"
import { logger } from "@/lib/logger"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    logger.info("Unauthenticated request — redirecting to login")
    redirect("/login")
  }

  logger.info("Dashboard layout — user authenticated", { userId: user.id })

  return (
    <ProfileProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <DashboardNav />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </ProfileProvider>
  )
}
