import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { reports } from "@/server/db/schema";
import { ReportActions } from "@/components/admin/AdminActions";
import { timeAgo } from "@/lib/utils";

export default async function AdminReports() {
  const rows = await db
    .select({
      r: reports,
      battleSlug: sql<string | null>`(SELECT slug FROM battle WHERE id = ${reports.targetId})`,
      battleTitle: sql<string | null>`(SELECT title FROM battle WHERE id = ${reports.targetId})`,
      reasonText: sql<string | null>`(SELECT reason FROM vote WHERE id = ${reports.targetId})`,
      userHandle: sql<string | null>`(SELECT handle FROM "user" WHERE id = ${reports.targetId})`,
    })
    .from(reports)
    .where(eq(reports.status, "OPEN"))
    .orderBy(sql`CASE WHEN ${reports.reason} = 'minor_safety' THEN 0 ELSE 1 END`, desc(reports.createdAt))
    .limit(100);
  if (!rows.length) return <p className="text-zinc-500">No open reports 🎉</p>;
  return (
    <ul className="space-y-2">
      {rows.map(({ r, battleSlug, battleTitle, reasonText, userHandle }) => (
        <li key={r.id} className={`card space-y-2 p-3 ${r.reason === "minor_safety" ? "border-red-400" : ""}`}>
          <div className="flex justify-between text-xs text-zinc-500">
            <span className={r.reason === "minor_safety" ? "font-medium text-red-600" : ""}>
              {r.targetType} · {r.reason}
            </span>
            <span>{timeAgo(r.createdAt)}</span>
          </div>
          <div className="text-sm">
            {r.targetType === "BATTLE" && battleSlug && <Link className="font-medium underline" href={`/b/${battleSlug}`}>{battleTitle}</Link>}
            {r.targetType === "REASON" && <span>“{reasonText}”</span>}
            {r.targetType === "USER" && userHandle && <Link className="font-medium underline" href={`/u/${userHandle}`}>@{userHandle}</Link>}
          </div>
          <ReportActions id={r.id} />
        </li>
      ))}
    </ul>
  );
}
