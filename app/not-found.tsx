import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link href="/stock-entries" className={buttonVariants({ variant: "outline" })}>
        Go to Stock Entries
      </Link>
    </div>
  )
}
