"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Package, BarChart2, Settings, LogOut, Menu } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { useProfileContext } from "@/components/shared/ProfileProvider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/stock-entries", label: "Stock Entry", icon: Package },
  { href: "/reports", label: "Reports", icon: BarChart2 },
]

export function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, loading, isAdmin } = useProfileContext()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Signed out successfully")
    router.push("/login")
    router.refresh()
  }

  const allItems = [
    ...navItems,
    ...(isAdmin ? [{ href: "/settings", label: "Settings", icon: Settings }] : []),
  ]

  const NavLinks = () => (
    <>
      {allItems.map((item) => {
        const active = pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href} className="relative">
            <span
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
            {active && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute inset-0 bg-accent rounded-md -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
          </Link>
        )
      })}
    </>
  )

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href="/stock-entries" className="flex items-center gap-2">
              <Package className="h-5 w-5 text-foreground" />
              <span className="font-semibold text-sm hidden sm:block">Vishalakshi Packaging</span>
            </Link>
            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {loading ? (
                <div className="flex items-center gap-1">
                  <Skeleton className="h-8 w-24 rounded-md" />
                  <Skeleton className="h-8 w-20 rounded-md" />
                </div>
              ) : (
                <NavLinks />
              )}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-3">
              {loading ? (
                <Skeleton className="h-4 w-24 rounded" />
              ) : (
                <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 cursor-pointer">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>

            {/* Mobile hamburger */}
            <Sheet>
              <SheetTrigger
                render={<Button variant="ghost" size="icon" className="md:hidden" />}
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col gap-4 mt-6">
                  <nav className="flex flex-col gap-1">
                    {loading ? (
                      <div className="space-y-1">
                        <Skeleton className="h-9 w-full rounded-md" />
                        <Skeleton className="h-9 w-full rounded-md" />
                      </div>
                    ) : (
                      <NavLinks />
                    )}
                  </nav>
                  <div className="pt-4 border-t">
                    {loading ? (
                      <Skeleton className="h-4 w-28 mb-3 rounded" />
                    ) : (
                      <p className="text-sm text-muted-foreground mb-3">{profile?.full_name}</p>
                    )}
                    <Button variant="outline" size="sm" onClick={handleLogout} className="w-full gap-1.5">
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
