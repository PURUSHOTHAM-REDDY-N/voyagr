import nodemailer from "nodemailer";

/**
 * Generic SMTP transport (works with Gmail, Outlook, a self-hosted mail
 * server, or any provider's SMTP relay - not tied to one vendor's API the
 * way Resend was). Built lazily and cached so route handlers don't pay the
 * connection-pool setup cost on every request.
 */
let transporter: nodemailer.Transporter | undefined;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be set to send email");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // implicit TLS on 465, STARTTLS on 587/25/etc.
    auth: { user, pass },
  });

  return transporter;
}

export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({ from, to, subject, html });
}
