const isEnabled = () => process.env.ENABLE_DEBUG_LOGS === 'true'

const ts = () => new Date().toISOString()

export const logger = {
  info: (msg: string, data?: unknown) => {
    if (!isEnabled()) return
    console.log(`[${ts()}] [INFO] ${msg}`, data !== undefined ? data : '')
  },
  // warn/error always log (ENABLE_DEBUG_LOGS only gates info/debug) so
  // production failures — e.g. a cron backup failing — show up in Vercel logs.
  warn: (msg: string, data?: unknown) => {
    console.warn(`[${ts()}] [WARN] ${msg}`, data !== undefined ? data : '')
  },
  error: (msg: string, data?: unknown) => {
    console.error(`[${ts()}] [ERROR] ${msg}`, data !== undefined ? data : '')
  },
  debug: (msg: string, data?: unknown) => {
    if (!isEnabled()) return
    console.debug(`[${ts()}] [DEBUG] ${msg}`, data !== undefined ? data : '')
  },
}
