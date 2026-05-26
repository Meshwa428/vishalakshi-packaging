"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Package, ArrowLeft, Home } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center text-center max-w-md"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.35, ease: "easeOut" }}
          className="mb-8 relative"
        >
          <div className="p-5 rounded-2xl bg-muted">
            <Package className="h-12 w-12 text-muted-foreground" />
          </div>
          {/* Badge */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.25, type: "spring", bounce: 0.4 }}
            className="absolute -top-2 -right-2 bg-foreground text-background text-xs font-bold px-2 py-0.5 rounded-full"
          >
            404
          </motion.div>
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="space-y-3 mb-8"
        >
          <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
        >
          <Link
            href="/stock-entries"
            className={cn(buttonVariants(), "gap-2 w-full sm:w-auto")}
          >
            <Home className="h-4 w-4" />
            Stock Entries
          </Link>
          <button
            onClick={() => window.history.back()}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2 w-full sm:w-auto cursor-pointer")}
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
