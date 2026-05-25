import nodemailer from "nodemailer";
import type { LeadRequest } from "./lead-storage";

const RECIPIENT = process.env.CONTACT_FORM_RECIPIENT_EMAIL || "rinartburo@mail.ru";

function getSmtpPort() {
  const rawPort = process.env.SMTP_PORT;
  const port = rawPort ? Number(rawPort) : 465;
  return Number.isFinite(port) ? port : 465;
}

export function isLeadMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendLeadEmail(lead: LeadRequest) {
  if (!isLeadMailConfigured()) {
    throw new Error("SMTP is not configured");
  }

  const port = getSmtpPort();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = `Новая заявка RINART: ${lead.source}`;
  const text = [
    "Новая заявка с сайта RINART",
    "",
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    `Источник: ${lead.source}`,
    lead.ip ? `IP: ${lead.ip}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await transporter.sendMail({
    from,
    to: RECIPIENT,
    replyTo: from,
    subject,
    text,
  });
}
