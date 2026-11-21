import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { battles, options, reports, users, votes } from "../db/schema";
import { getConfig } from "./config";
import { isSevere, shouldAutoHide, SYSTEM_REASONS, REASON_LABELS, type ReportReason } from "./safety";
import { sendEmail } from "../email";
import { appUrl } from "@/lib/utils";
import { AppError } from "../errors";

type ReportInput = { targetType: "BATTLE" | "REASON" | "USER"; targetId: string; reason: ReportReason; details?: string };

/**
 * A user (or guest) flags a battle, a reason or a profile. Signed-in users can flag a target once.
 * Battles hide themselves pending review once open flags reach the thresholds in `shouldAutoHide`.
 */
export async function submitReport(input: ReportInput, reporterId: string | null): Promise<{ hidden: boolean }> {
  if (reporterId) {
    const [dupe] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.targetId, input.targetId), eq(reports.reporterId, reporterId), eq(reports.status, "OPEN")));
    if (dupe) return { hidden: false };
  }
  await db.insert(reports).values({ ...input, details: input.details || null, reporterId });
  let hidden = false;
  if (input.targetType === "BATTLE") {
    const [b] = await db
      .update(battles)
      .set({ reportCount: sql`${battles.reportCount} + 1` })
      .where(eq(battles.id, input.targetId))
      .returning({ id: battles.id, status: battles.status, slug: battles.slug, title: battles.title });
    if (!b) throw new AppError("NOT_FOUND", "That battle no longer exists");
    if (b.status !== "HIDDEN" && b.status !== "DELETED") {
      const { features } = await getConfig();
      const rows = await db
        .select({ reason: reports.reason, n: sql<number>`count(*)::int` })
        .from(reports)
        .where(and(eq(reports.targetId, b.id), eq(reports.status, "OPEN")))
        .groupBy(reports.reason);
      const counts = { total: 0, severe: 0, childSafety: 0 };
      for (const r of rows) {
        counts.total += r.n;
        if (isSevere(r.reason)) counts.severe += r.n;
        if (r.reason === "minor_safety") counts.childSafety += r.n;
      }
      if (shouldAutoHide(counts, features)) {
        await db.update(battles).set({ status: "HIDDEN", updatedAt: new Date() }).where(eq(battles.id, b.id));
        hidden = true;
        await alertAdmins(`Battle auto-hidden after ${counts.total} flag${counts.total > 1 ? "s" : ""}`, `"${b.title}" (${appUrl(`/b/${b.slug}`)})`);
      }
    }
  }
  if (input.targetType === "REASON" && input.reason === "minor_safety")
    await db.update(votes).set({ reasonHidden: true }).where(eq(votes.id, input.targetId));
  return { hidden };
}

/** A battle's photos were held by automated screening: record a system report so it lands in the admin queue. */
export async function recordAutoHold(battleId: string, title: string, slug: string, reasons: string[]) {
  await db.insert(reports).values({ targetType: "BATTLE", targetId: battleId, reason: SYSTEM_REASONS.autoScreen, details: reasons.join(", ").slice(0, 500) });
  await alertAdmins("Photo held for review", `"${title}" (${appUrl(`/b/${slug}`)}): ${reasons.join(", ")}`);
}

/**
 * Known-CSAM hash match on upload. The user is banned, the image URL is recorded (not deleted:
 * US law requires reporting to NCMEC's CyberTipline and preserving the material), and admins are alerted.
 */
export async function recordHashMatch(userId: string, imageUrls: string[]) {
  await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, userId));
  await db.insert(reports).values({
    targetType: "USER",
    targetId: userId,
    reason: SYSTEM_REASONS.hashMatch,
    details: `Matched image(s): ${imageUrls.join(" ")}`.slice(0, 500),
  });
  await alertAdmins("URGENT: known child abuse image blocked", `An upload matched a known CSAM hash. The account was banned. Report it to NCMEC (report.cybertip.org) within 24h and preserve the evidence. Details in ${appUrl("/admin/reports")}.`);
}

export const ADMIN_ACTIONS = ["approve", "hide", "delete", "ban", "dismiss"] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** Admin decision on a report. Applies to the target and closes every open report on it. */
export async function resolveReport(id: string, action: AdminAction, adminId: string) {
  const [r] = await db.select().from(reports).where(eq(reports.id, id));
  if (!r) throw new AppError("NOT_FOUND", "Report not found");
  if (r.targetType === "BATTLE") {
    const set = (status: "OPEN" | "HIDDEN" | "DELETED") => db.update(battles).set({ status, updatedAt: new Date() }).where(eq(battles.id, r.targetId));
    if (action === "hide") await set("HIDDEN");
    if (action === "delete") await set("DELETED");
    // Approve/dismiss un-hide; a battle past its deadline closes lazily on the next read.
    if (action === "approve" || action === "dismiss") await db.update(battles).set({ status: "OPEN", updatedAt: new Date() }).where(and(eq(battles.id, r.targetId), eq(battles.status, "HIDDEN")));
    if (action === "ban") {
      const [b] = await db.select({ a: battles.authorId }).from(battles).where(eq(battles.id, r.targetId));
      if (b) await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, b.a));
      await set("HIDDEN");
    }
  }
  if (r.targetType === "REASON") {
    if (action === "hide" || action === "delete") await db.update(votes).set({ reasonHidden: true }).where(eq(votes.id, r.targetId));
    if (action === "approve" || action === "dismiss") await db.update(votes).set({ reasonHidden: false }).where(eq(votes.id, r.targetId));
    if (action === "ban") {
      const [v] = await db.select({ u: votes.userId }).from(votes).where(eq(votes.id, r.targetId));
      if (v?.u) await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, v.u));
      await db.update(votes).set({ reasonHidden: true }).where(eq(votes.id, r.targetId));
    }
  }
  if (r.targetType === "USER" && action === "ban") await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, r.targetId));
  const status = action === "approve" || action === "dismiss" ? "DISMISSED" : "ACTIONED";
  await db
    .update(reports)
    .set({ status, resolvedBy: adminId, resolvedAt: new Date() })
    .where(and(eq(reports.targetId, r.targetId), eq(reports.status, "OPEN")));
}

export async function openReportCount() {
  const [{ n }] = await db.select({ n: sql<number>`count(DISTINCT ${reports.targetId})::int` }).from(reports).where(eq(reports.status, "OPEN"));
  return n;
}

/**
 * The admin review queue: one row per flagged target (open reports grouped), most urgent first
 * (hash matches, child safety, nudity, auto-screen holds, then the rest), with photos for battles.
 */
export async function reviewQueue(limit = 100) {
  const rows = await db.execute<{
    target_type: "BATTLE" | "REASON" | "USER";
    target_id: string;
    report_id: string;
    reasons: string[];
    details: string[];
    n: number;
    first_at: string;
    battle_slug: string | null;
    battle_title: string | null;
    battle_status: string | null;
    author_handle: string | null;
    reason_text: string | null;
    user_handle: string | null;
  }>(sql`
    SELECT r.target_type, r.target_id, (array_agg(r.id ORDER BY r.created_at))[1] AS report_id,
      array_agg(DISTINCT r.reason) AS reasons, array_remove(array_agg(r.details), NULL) AS details,
      count(*)::int AS n, to_char(min(r.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS first_at,
      b.slug AS battle_slug, b.title AS battle_title, b.status AS battle_status, au.handle AS author_handle,
      v.reason AS reason_text, u.handle AS user_handle
    FROM report r
    LEFT JOIN battle b ON r.target_type = 'BATTLE' AND b.id = r.target_id
    LEFT JOIN "user" au ON au.id = b.author_id
    LEFT JOIN vote v ON r.target_type = 'REASON' AND v.id = r.target_id
    LEFT JOIN "user" u ON r.target_type = 'USER' AND u.id = r.target_id
    WHERE r.status = 'OPEN'
    GROUP BY r.target_type, r.target_id, b.slug, b.title, b.status, au.handle, v.reason, u.handle
    ORDER BY max(CASE r.reason WHEN 'csam_hash_match' THEN 5 WHEN 'minor_safety' THEN 4 WHEN 'nudity' THEN 3 WHEN 'auto_screen' THEN 2 ELSE 0 END) DESC,
      count(*) DESC, min(r.created_at)
    LIMIT ${limit}`);
  const battleIds = rows.filter((r) => r.target_type === "BATTLE").map((r) => r.target_id);
  const opts = battleIds.length
    ? await db
        .select({ battleId: options.battleId, side: options.side, label: options.label, imageUrl: options.imageUrl, urlImage: options.urlImage })
        .from(options)
        .where(inArray(options.battleId, battleIds))
    : [];
  return rows.map((r) => ({
    ...r,
    labels: r.reasons.map((x) => REASON_LABELS[x] ?? x),
    photos: opts
      .filter((o) => o.battleId === r.target_id)
      .sort((a, b) => a.side.localeCompare(b.side))
      .map((o) => ({ side: o.side, label: o.label, url: o.imageUrl || o.urlImage })),
  }));
}

/** Email admins (MODERATION_ALERT_EMAIL, else CONTACT_ALERT_EMAIL) once Resend is configured. */
async function alertAdmins(subject: string, body: string) {
  const to = (process.env.MODERATION_ALERT_EMAIL || process.env.CONTACT_ALERT_EMAIL)?.trim();
  if (!to || !process.env.AUTH_RESEND_KEY) return;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const link = appUrl("/admin/reports");
  try {
    await sendEmail({
      to,
      subject: `[crowdpick moderation] ${subject}`,
      text: `${body}\n\nReview queue: ${link}`,
      html: `<p>${esc(body)}</p><p><a href="${link}">Open the review queue</a></p>`,
    });
  } catch (e) {
    console.error("[moderation] alert failed", e);
  }
}
