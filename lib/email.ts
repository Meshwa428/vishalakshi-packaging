import { Resend } from "resend"
import { logger } from "@/lib/logger"

// Lazily instantiated so build doesn't fail without RESEND_API_KEY
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY env var is not set")
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

interface SendBackupEmailParams {
  subject: string
  body: string
  attachmentName: string
  attachmentBuffer: Buffer
}

export async function sendBackupEmail({
  subject,
  body,
  attachmentName,
  attachmentBuffer,
}: SendBackupEmailParams) {
  const to = process.env.BACKUP_EMAIL
  if (!to) {
    logger.error("BACKUP_EMAIL env var not set — skipping email send")
    throw new Error("BACKUP_EMAIL not configured")
  }

  logger.info(`Sending backup email to ${to}`, { subject, attachment: attachmentName })

  const { data, error } = await getResend().emails.send({
    from: "Vishalakshi Packaging Backup <onboarding@resend.dev>",
    to: [to],
    subject,
    text: body,
    attachments: [
      {
        filename: attachmentName,
        content: attachmentBuffer,
      },
    ],
  })

  if (error) {
    logger.error("Failed to send backup email", error)
    throw new Error(`Email send failed: ${error.message}`)
  }

  logger.info("Backup email sent successfully", { id: data?.id })
  return data
}
