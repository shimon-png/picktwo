import Link from "next/link";
import { timeAgo } from "@/lib/utils";

export type HistoryRow = {
  id: string;
  title: string;
  updated_at: string;
  kind: string | null;
  slug: string | null;
  status: string | null;
  votes: number | null;
  deadline: string | null;
  results_at: string | null;
};

/** "Your questions" (PRD S9): each Pickbot thread, its answer type and where the crowd stands. */
export function PickbotHistory({ rows, title = "Your questions" }: { rows: HistoryRow[]; title?: string }) {
  if (!rows.length) return null;
  return (
    <section className="space-y-2">
      {title && <h2 className="text-[22px]">{title}</h2>}
      <ul className="divide-y divide-ink/10 overflow-hidden rounded-[16px] bg-white shadow-soft">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/ask/${r.id}`} className="block px-4 py-3">
              <span className="block truncate text-[15px] text-ink">{r.title}</span>
              <span className="text-[12px] text-ink/55">
                {r.kind === "tailored" ? "Tailored" : r.kind === "general" ? "General" : "No answer yet"}
                {" · "}
                {r.slug
                  ? r.results_at
                    ? "crowd results in"
                    : `crowd voting, ${r.votes ?? 0} vote${r.votes === 1 ? "" : "s"}`
                  : "not posted"}
                {" · "}
                {timeAgo(r.updated_at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
