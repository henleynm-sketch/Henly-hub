import "server-only";
import { prisma } from "@/lib/prisma";

import type { Notification } from "@prisma/client";
import { getBaseUrl, type Recipient } from "@/lib/notifications/events";
import { formatMoney } from "@/lib/utils";

/**
 * Branded email templates — Henley serif header, black/white with one accent.
 * Email clients cannot read CSS variables, so the palette is hardcoded HERE
 * ONLY, mirroring globals.css tokens: --accent #4C7DFF, ink #0A0A0B on white.
 * Every template ships an HTML + plain-text pair; external recipients get a
 * tokenized unsubscribe link (public, scope-limited, no auth).
 */

const ACCENT = "#4C7DFF"; // = --accent
const INK = "#0A0A0B"; // = --white token's light-scope value
const MUTED = "#5A616B"; // = --fog light-scope

function layout(title: string, bodyHtml: string, footerHtml: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F4F5F7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;font-family:Segoe UI,Arial,sans-serif;">
<tr><td style="padding:28px 32px;border-bottom:3px solid ${ACCENT};">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:2px;color:${INK};">HENLEY</div>
  <div style="font-size:10px;letter-spacing:3px;color:${MUTED};">CONTRACTING LTD.</div>
</td></tr>
<tr><td style="padding:28px 32px;color:${INK};font-size:14px;line-height:1.6;">
  <h1 style="font-size:17px;margin:0 0 14px;">${title}</h1>
  ${bodyHtml}
</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #E5E7EB;font-size:11px;color:${MUTED};">
  Henley Contracting Ltd. · hello@henleycontracting.com
  ${footerHtml}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${href}" style="background:${ACCENT};color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:13px;">${label}</a></p>`;
}

// Web Crypto HMAC (no node:crypto import — instrumentation also bundles for
// the Edge runtime, where that module cannot resolve). Stateless token; the
// public route verifies it and only then writes the suppression row.
export async function unsubscribeToken(email: string): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET ?? "henley-hub-unsub";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(email.toLowerCase())));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function unsubscribeFooter(email: string): Promise<{ html: string; text: string }> {
  const lower = email.toLowerCase();
  const token = await unsubscribeToken(lower);
  const base = await getBaseUrl();
  const href = `${base}/unsubscribe?token=${token}&email=${encodeURIComponent(lower)}`;
  return {
    html: `<br/><a href="${href}" style="color:${MUTED};">Unsubscribe from Henley Hub emails</a>`,
    text: `\n\nUnsubscribe: ${href}`,
  };
}

type Rendered = { subject: string; html: string; text: string };

export async function renderTemplate(n: Notification, r: Recipient): Promise<Rendered> {
  const payload = n.payload ? (JSON.parse(n.payload) as Record<string, unknown>) : {};
  const base = await getBaseUrl();
  const external = r.type === "client" || r.type === "vendor";
  const footer = external ? await unsubscribeFooter(r.email) : { html: "", text: "" };

  const job = n.jobId
    ? await prisma.project.findUnique({
        where: { id: n.jobId },
        select: { id: true, name: true, address: true, code: true },
      })
    : null;
  const jobLine = job ? `${job.name}${job.address ? ` — ${job.address}` : ""}` : "";

  const p = (s: unknown) => String(s ?? "");
  let subject = "Henley Hub update";
  let body = "";
  let text = "";

  switch (n.eventType) {
    case "INVITE":
      subject = `You're invited to Henley Hub`;
      body = `<p>${p(payload.inviterName)} invited you to Henley Hub as <strong>${p(payload.roleLabel)}</strong> for ${p(payload.orgName)}.</p><p>The link is valid for 7 days.</p>${button(`${base}/invite/${p(payload.rawToken)}`, "Accept invitation")}`;
      text = `You're invited to Henley Hub as ${p(payload.roleLabel)}. Accept (7 days): ${base}/invite/${p(payload.rawToken)}`;
      break;
    case "PASSWORD_RESET":
      subject = "Reset your Henley Hub password";
      body = `<p>A password reset was requested for this address. The link is valid for 1 hour — if you didn't ask for it, ignore this email.</p>${button(`${base}/reset/${p(payload.rawToken)}`, "Reset password")}`;
      text = `Reset your Henley Hub password (1 hour): ${base}/reset/${p(payload.rawToken)}`;
      break;
    case "TEST_EMAIL":
      subject = "Henley Hub — test email";
      body = `<p>This is the notification rail verification send. If you are reading this in Outlook, Graph sendMail from hello@ works end to end.</p>`;
      text = "Notification rail verification send.";
      break;
    case "DAILY_LOG_CLIENT":
      subject = `Progress update — ${jobLine}`;
      body = `<p>A new site update was posted for <strong>${jobLine}</strong>:</p><p style="background:#F4F5F7;padding:14px;border-radius:8px;">${p(payload.notes)}</p>${button(`${base}/dashboard`, "View in your portal")}`;
      text = `New site update for ${jobLine}: ${p(payload.notes)}`;
      break;
    case "SELECTION_PROPOSED":
      subject = `Selection ready for your review — ${p(payload.category)}`;
      body = `<p>A selection is ready for your decision on <strong>${jobLine}</strong>: <strong>${p(payload.category)}</strong> — ${p(payload.option)}.</p>${button(`${base}/dashboard`, "Review selection")}`;
      text = `Selection ready: ${p(payload.category)} — ${p(payload.option)} (${jobLine})`;
      break;
    case "SELECTION_REMINDER":
    case "SELECTION_OVERDUE_CLIENT":
      subject = n.eventType === "SELECTION_REMINDER" ? `Reminder — selection due soon` : `Selection overdue — ${p(payload.category)}`;
      body = `<p>The <strong>${p(payload.category)}</strong> selection on <strong>${jobLine}</strong> ${n.eventType === "SELECTION_REMINDER" ? "is due in 2 days" : "is overdue"}. Your decision keeps the schedule on track.</p>${button(`${base}/dashboard`, "Decide now")}`;
      text = `${p(payload.category)} selection ${n.eventType === "SELECTION_REMINDER" ? "due in 2 days" : "overdue"} — ${jobLine}`;
      break;
    case "ESTIMATE_SENT":
      subject = `Your estimate from Henley Contracting — ${p(payload.number)}`;
      body = `<p>Estimate <strong>${p(payload.number)}</strong> (${p(payload.title)}) is ready: <strong>${formatMoney(Number(payload.totalCents ?? 0))}</strong>.</p>${button(`${base}/dashboard`, "View estimate")}`;
      text = `Estimate ${p(payload.number)} — ${formatMoney(Number(payload.totalCents ?? 0))}`;
      break;
    case "CONTRACT_SENT":
      subject = `Contract ready to sign — ${p(payload.number)}`;
      body = `<p>Contract <strong>${p(payload.number)}</strong> for <strong>${jobLine || p(payload.title)}</strong> is ready for signature. Total <strong>${formatMoney(Number(payload.totalCents ?? 0))}</strong>${Number(payload.depositCents ?? 0) > 0 ? `, deposit ${formatMoney(Number(payload.depositCents))} on signing` : ""}.</p>`;
      text = `Contract ${p(payload.number)} ready to sign.`;
      break;
    case "CONTRACT_SIGNED_CLIENT":
      subject = `Signed and confirmed — ${p(payload.number)}`;
      body = `<p>Thank you — contract <strong>${p(payload.number)}</strong> is signed and on file. We're excited to build with you.</p>`;
      text = `Contract ${p(payload.number)} signed and confirmed.`;
      break;
    case "MILESTONE_DUE_CLIENT":
      subject = `Coming up on your project — ${p(payload.title)}`;
      body = `<p><strong>${p(payload.title)}</strong> on <strong>${jobLine}</strong> is scheduled for ${p(payload.dueDate)}.</p>`;
      text = `${p(payload.title)} due ${p(payload.dueDate)} — ${jobLine}`;
      break;
    case "ESTIMATE_ACCEPTED":
      subject = `Estimate accepted — ${p(payload.number)} (${formatMoney(Number(payload.totalCents ?? 0))})`;
      body = `<p><strong>${p(payload.clientName)}</strong> accepted estimate <strong>${p(payload.number)}</strong> — ${formatMoney(Number(payload.totalCents ?? 0))}.</p>${button(`${base}/estimates/${p(payload.estimateId)}`, "Open estimate")}`;
      text = `${p(payload.clientName)} accepted ${p(payload.number)}.`;
      break;
    case "SELECTION_DECIDED":
      subject = `Selection ${p(payload.status).toLowerCase()} — ${p(payload.category)}`;
      body = `<p>Client ${p(payload.status).toLowerCase()} the <strong>${p(payload.category)}</strong> selection on <strong>${jobLine}</strong>.</p>${button(`${base}/projects/${n.jobId ?? ""}`, "Open job")}`;
      text = `Selection ${p(payload.status)} — ${p(payload.category)} (${jobLine})`;
      break;
    case "JOB_STAGE_CHANGED":
      subject = `Job moved — ${jobLine}`;
      body = `<p><strong>${jobLine}</strong>: ${p(payload.axis)} → <strong>${p(payload.value) || "(cleared)"}</strong>.</p>${button(`${base}/jobs/${n.jobId ?? ""}`, "Open cockpit")}`;
      text = `${jobLine}: ${p(payload.axis)} -> ${p(payload.value)}`;
      break;
    case "INBOX_MESSAGE":
      subject = `New message — ${p(payload.subject)}`;
      body = `<p>New inbound message on <strong>${p(payload.subject)}</strong> (${p(payload.channel)}).</p>${button(`${base}/inbox`, "Open inbox")}`;
      text = `New message: ${p(payload.subject)}`;
      break;
    case "TIME_APPROVALS_DAILY":
      subject = `${p(payload.count)} time entr${Number(payload.count) === 1 ? "y" : "ies"} awaiting approval`;
      body = `<p><strong>${p(payload.count)}</strong> completed time entr${Number(payload.count) === 1 ? "y is" : "ies are"} waiting for approval.</p>${button(`${base}/projects`, "Review time")}`;
      text = `${p(payload.count)} time entries awaiting approval.`;
      break;
    case "JOB_ASSIGNED":
      subject = `You've been added to a job — ${jobLine}`;
      body = `<p>You've been assigned to <strong>${jobLine}</strong> as ${p(payload.role)}.</p>${button(`${base}/projects/${n.jobId ?? ""}`, "Open job")}`;
      text = `Assigned to ${jobLine} as ${p(payload.role)}.`;
      break;
    case "VENDOR_ASSIGNED":
      subject = `Henley Contracting — job assignment${job?.address ? ` at ${job.address}` : ""}`;
      body = `<p>You've been engaged for <strong>${jobLine}</strong>.${payload.dates ? ` Scheduled: ${p(payload.dates)}.` : ""}</p><p>Reply to this email or call the office with any questions.</p>`;
      text = `Engaged for ${jobLine}. ${payload.dates ? `Scheduled: ${p(payload.dates)}` : ""}`;
      break;
    case "VENDOR_COI_EXPIRING":
      subject = `Certificate of Insurance expires soon — action needed`;
      body = `<p>Our records show your COI on file with Henley Contracting expires on <strong>${p(payload.expires)}</strong>. Please send an updated certificate to hello@henleycontracting.com.</p>`;
      text = `Your COI expires ${p(payload.expires)}. Please send an updated certificate.`;
      break;
    case "VENDOR_COI_EXPIRED":
      subject = `Certificate of Insurance expired — required before next site visit`;
      body = `<p>Your COI on file expired <strong>${p(payload.expires)}</strong>. An active certificate is required before further site work. Please send the renewal to hello@henleycontracting.com.</p>`;
      text = `Your COI expired ${p(payload.expires)}. Renewal required.`;
      break;
    case "VENDOR_W9_NUDGE":
      subject = `W-9 needed on file — Henley Contracting`;
      body = `<p>We don't have a W-9 on file for you. Please reply with a completed form so payments aren't delayed.</p>`;
      text = `We don't have a W-9 on file for you — please reply with one.`;
      break;
    default:
      body = `<p>Update from Henley Hub.</p>`;
      text = "Update from Henley Hub.";
  }

  return {
    subject,
    html: layout(subject, body, footer.html),
    text: `${text}${footer.text}`,
  };
}
