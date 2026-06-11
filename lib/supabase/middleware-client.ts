import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims() verifies the JWT locally (no network round-trip) when the
  // project uses asymmetric JWT signing keys, and still refreshes the session
  // cookie. This runs on every navigation, so avoiding the getUser() network
  // call to Supabase Auth is the single biggest navigation-latency win.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub ?? null

  const { pathname } = request.nextUrl

  // Unauthenticated user trying to access protected route
  if (!userId && pathname !== "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Authenticated user trying to visit login
  if (userId && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/stock-entries"
    return NextResponse.redirect(url)
  }

  // Settings page: admin only
  if (userId && pathname.startsWith("/settings")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/stock-entries"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
