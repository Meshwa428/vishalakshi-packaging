import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware-client"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // api/cron is excluded: Vercel Cron calls carry no session cookie and
    // authenticate via CRON_SECRET inside the route handlers instead.
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
