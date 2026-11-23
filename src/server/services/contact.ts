import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { contactMessages, type ContactMessage } from "@/server/db/schema";
import { sendEmail } from "@/server/email";
import { AppError } from "@/server/errors";
import { appUrl } from "@/lib/utils";
import { CONTACT_TOPICS } from "@/lib/validators";

export type ContactStatus = "NEW" | "HANDLED";

export function topicLabel(id: string) {
  return CONTACT_TOPICS.find((t) => t.id === id)?.label ?? id;
}

export async function createContactMessage(input: {
  name?: string;
  email: string;
  topic: string;
  message: string;
  userId?: string | null;
  pageUrl?: string;
  userAgent?: string | null;
}) {
  const [row] = await db
    .insert(contactMessages)
    .values({
      name: input.name ?? null,
      email: input.email,
      topic: input.topic,
      message: input.message,
      userId: input.userId ?? null,
      pageUrl: input.pageUrl?.slice(0, 500) ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
    })
    .returning();
  await notifyAdmins(row).catch((e) => console.error("[contact] alert failed", e));
  return row;
}

/**
 * Optional email alert. Set CONTACT_ALERT_EMAIL (comma-separated) once Resend is
 * configured (AUTH_RESEND_KEY); until then messages just wait in /admin/messages.
 */
async function notifyAdmins(m: ContactMessage) {
  const to = process.env.CONTACT_ALERT_EMAIL?.trim();
  if (!to || !process.env.AUTH_RESEND_KEY) return;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const link = appUrl("/admin/messages");
  await sendEmail({
    to,
    subject: `New contact message: ${topicLabel(m.topic)}`,
    text: `From: ${m.name ?? "(no name)"} <${m.email}>\nTopic: ${topicLabel(m.topic)}\n\n${m.message}\n\nInbox: ${link}`,
    html: `<p><b>From:</b> ${esc(m.name ?? "(no name)")} &lt;${esc(m.email)}&gt;<br><b>Topic:</b> ${esc(topicLabel(m.topic))}</p><p style="white-space:pre-wrap">${esc(m.message)}</p><p><a href="${link}">Open the inbox</a></p>`,
  });
}

export async function listContactMessages(status: ContactStatus | "ALL", limit = 200) {
  const q = db.select().from(contactMessages);
  return (status === "ALL" ? q : q.where(eq(contactMessages.status, status))).orderBy(desc(contactMessages.createdAt)).limit(limit);
}

export async function unreadContactCount() {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(contactMessages)
    .where(eq(contactMessages.status, "NEW"));
  return n;
}

/** Message counts per status in one grouped query (for the inbox tab badges). */
export async function contactCounts() {
  const rows = await db
    .select({ status: contactMessages.status, n: sql<number>`count(*)::int` })
    .from(contactMessages)
    .groupBy(contactMessages.status);
  const by = (st: string) => rows.find((r) => r.status === st)?.n ?? 0;
  const NEW = by("NEW");
  const HANDLED = by("HANDLED");
  return { NEW, HANDLED, ALL: rows.reduce((a, r) => a + r.n, 0) };
}

export async function setContactStatus(id: string, status: ContactStatus, adminId: string) {
  const [row] = await db
    .update(contactMessages)
    .set(status === "HANDLED" ? { status, handledBy: adminId, handledAt: new Date() } : { status, handledBy: null, handledAt: null })
    .where(eq(contactMessages.id, id))
    .returning({ id: contactMessages.id });
  if (!row) throw new AppError("NOT_FOUND", "Message not found");
  return row;
}
