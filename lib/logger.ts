const isEnabled = () => process.env.ENABLE_DEBUG_LOGS === 'true'

const ts = () => new Date().toISOString()

export const logger = {
  info: (msg: string, data?: unknown) => {
    if (!isEnabled()) return
    console.log(`[${ts()}] [INFO] ${msg}`, data !== undefined ? data : '')
  },
  warn: (msg: string, data?: unknown) => {
    if (!isEnabled()) return
    console.warn(`[${ts()}] [WARN] ${msg}`, data !== undefined ? data : '')
  },
  error: (msg: string, data?: unknown) => {
    if (!isEnabled()) return
    console.error(`[${ts()}] [ERROR] ${msg}`, data !== undefined ? data : '')
  },
  debug: (msg: string, data?: unknown) => {
    if (!isEnabled()) return
    console.debug(`[${ts()}] [DEBUG] ${msg}`, data !== undefined ? data : '')
  },
}
