/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { reviewQueue } from "@/server/services/reports";
import { screeningEnabled, hashMatchEnabled } from "@/server/moderation";
import { ReportActions } from "@/components/admin/AdminActions";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const URGENT = new Set(["csam_hash_match", "minor_safety"]);

export default async function AdminReports() {
  const rows = await reviewQueue();
  return (
    <div className="space-y-3">
      <div className="card space-y-1 p-3 text-[13px] text-zinc-600">
        <p>
          Photo screening: <b className={screeningEnabled() ? "text-green" : "text-b"}>{screeningEnabled() ? "on" : "off (set OPENAI_API_KEY)"}</b> · Known-CSAM hash match:{" "}
          <b className={hashMatchEnabled() ? "text-green" : "text-b"}>{hashMatchEnabled() ? "on" : "off (set PHOTODNA_KEY)"}</b>
        </p>
        <p>
          Photos are blurred until you tap them. If you believe an image shows a child being sexually abused, do not open it again, do not delete it: ban, then report it to{" "}
          <a className="underline" href="https://report.cybertip.org" target="_blank" rel="noreferrer">
            NCMEC’s CyberTipline
          </a>
          .
        </p>
      </div>
      {!rows.length ? (
        <p className="text-zinc-500">Nothing to review 🎉</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const urgent = r.reasons.some((x) => URGENT.has(x));
            return (
              <li key={r.target_type + r.target_id} className={`card space-y-2 p-3 ${urgent ? "border-red-400" : ""}`}>
                <div className="flex justify-between gap-2 text-xs text-zinc-500">
                  <span className={urgent ? "font-medium text-red-600" : ""}>
                    {r.labels.join(" · ")}
                    {r.n > 1 && ` · ${r.n} flags`}
                  </span>
                  <span className="shrink-0">{timeAgo(new Date(r.first_at))}</span>
                </div>
                <div className="text-sm">
                  {r.target_type === "BATTLE" && r.battle_slug && (
                    <>
                      <Link className="font-medium underline" href={`/b/${r.battle_slug}`}>
                        {r.battle_title}
                      </Link>
                      <span className="text-zinc-500">
                        {" "}
                        by @{r.author_handle} · {r.battle_status === "HIDDEN" ? "hidden" : r.battle_status?.toLowerCase()}
                      </span>
                    </>
                  )}
                  {r.target_type === "REASON" && <span>“{r.reason_text}”</span>}
                  {r.target_type === "USER" && r.user_handle && (
                    <Link className="font-medium underline" href={`/u/${r.user_handle}`}>
                      @{r.user_handle}
                    </Link>
                  )}
                </div>
                {r.photos.some((p) => p.url) && !r.reasons.includes("csam_hash_match") && (
                  <div className="grid grid-cols-2 gap-2">
                    {r.photos.map((p) => (
                      <details key={p.side} className="group relative overflow-hidden rounded-lg bg-zinc-100">
                        <summary className="list-none cursor-pointer">
                          {p.url ? (
                            <img src={p.url} alt={p.label} className="aspect-square w-full object-cover blur-2xl group-open:blur-0" />
                          ) : (
                            <div className="grid aspect-square place-items-center text-xs text-zinc-500">No photo</div>
                          )}
                          <span className="absolute bottom-1 left-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white">
                            {p.side} · {p.label} <span className="group-open:hidden">· tap to view</span>
                          </span>
                        </summary>
                      </details>
                    ))}
                  </div>
                )}
                {r.details.length > 0 && <p className="text-xs text-zinc-500">{r.details.slice(0, 5).join(" · ")}</p>}
                <ReportActions id={r.report_id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
