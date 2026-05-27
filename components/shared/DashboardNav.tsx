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
    <>
      {/* Top header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <Link href="/stock-entries" className="flex items-center gap-2">
                <Package className="h-5 w-5 text-foreground" />
                <span className="font-semibold text-sm">Vishalakshi Packaging</span>
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

              {/* Mobile hamburger — nav + user info + sign out */}
              <Sheet>
                <SheetTrigger
                  render={<Button variant="ghost" size="icon" className="md:hidden" />}
                >
                  <Menu className="h-5 w-5" />
                </SheetTrigger>
                <SheetContent side="right" className="w-64 p-4 pt-12">
                  {/* User info */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {profile?.full_name?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      {loading ? (
                        <>
                          <Skeleton className="h-3.5 w-24 mb-1 rounded" />
                          <Skeleton className="h-3 w-16 rounded" />
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium leading-tight truncate">{profile?.full_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleLogout} className="w-full gap-1.5">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch h-16">
          {loading ? (
            <div className="flex items-center justify-around w-full px-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
              ))}
            </div>
          ) : (
            allItems.map((item) => {
              const active = pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] transition-colors relative",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="mobile-nav-indicator"
                      className="absolute inset-x-2 inset-y-1.5 bg-accent rounded-lg -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                    />
                  )}
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              )
            })
          )}
        </div>
      </nav>
    </>
  )
}
