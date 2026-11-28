import Link from "next/link";
import { signupJourneys } from "@/server/services/signup-journeys";
import { themeLabel } from "@/lib/theme-guess";
import { Section, battleLink, nyTime, type TabProps } from "../ui";
import { loadThemes } from "./deck";

/** Person by person: real voters and new sign-ups. The funnel and demographics live on /admin/journey. */
export async function PeopleTab({ days, view }: TabProps) {
  const [te, journeys] = await Promise.all([loadThemes(days, view), signupJourneys()]);
  return (
    <>
      <p className="text-sm">
        <Link href={`/admin/journey?days=${days}${view === "all" ? "&view=all" : ""}`} className="text-accent underline-offset-2 hover:underline">
          Open the Journey ›
        </Link>{" "}
        <span className="text-xs text-zinc-500">for the funnel and who is in each step (source, sex, age, ZIP area).</span>
      </p>
      <Section
        title="New sign-ups, one by one"
        note="Real accounts since the clean start date, newest first (admins left out, no emails, ZIP cut to 3 digits). Source is their first visit. Tap a row to see every vote, before and after signing up. Back days = later New York days they visited again."
      >
        {journeys.length === 0 ? (
          <p className="text-sm text-zinc-500">No sign-ups yet.</p>
        ) : (
          <div className="divide-y divide-ink/10">
            {journeys.map((j) => (
              <details key={`${j.handle}-${j.signedUpAt}`} className="py-2">
                <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">@{j.handle ?? "?"}</span>
                  <span className="text-xs text-zinc-500">{j.signedUpAt ? nyTime(j.signedUpAt) : "guest"}</span>
                  <span className={`chip !py-0.5 text-[11px] ${j.source.startsWith("x_") ? "chip-on" : ""}`}>{j.sourceLabel}</span>
                  <span className="text-xs text-zinc-500">
                    {[j.sex, j.ageRange, j.zip3 && `ZIP ${j.zip3}xx`].filter(Boolean).join(" · ") || "no profile"}
                  </span>
                  <span className="ml-auto text-xs tabular-nums">
                    votes {j.votesBefore} before / <b>{j.votesAfter} after</b> · posts {j.posts} · Pickbot {j.asks.length} · back days {j.returnDays}
                  </span>
                </summary>
                <div className="mt-2 space-y-1 pl-1 text-xs">
                  <p className="text-zinc-500">
                    First visit tag: {j.sourceTag || "none"} · follows {j.follows} · last seen {j.lastSeen ? nyTime(j.lastSeen) : "—"} ·{" "}
                    <Link href={`/admin/journey/person/${encodeURIComponent(j.who)}`} className="text-accent underline-offset-2 hover:underline">
                      Full journey ›
                    </Link>
                  </p>
                  {j.votes.length === 0 ? (
                    <p className="text-zinc-500">No votes.</p>
                  ) : (
                    <ol className="space-y-0.5">
                      {j.votes.map((v, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="w-28 shrink-0 text-zinc-500">{nyTime(v.at)}</span>
                          <span className={`w-12 shrink-0 ${v.after ? "text-green" : "text-zinc-500"}`}>{v.after ? "after" : "before"}</span>
                          <span className="min-w-0 flex-1">
                            {battleLink(v.slug, v.title)} <span className="text-zinc-500">→ {v.picked}{v.method ? ` (${v.method})` : ""}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`Real voters, one by one (${te.voters.length})`}
        note="Everyone who cast a counted vote in this window, most votes first (same people as the People who voted tile). Seen = Vote deck cards; Left = seen with no vote or skip. Tap a row for the battles they skipped and their full journey."
      >
        <div className="divide-y divide-ink/10">
          {te.voters.slice(0, 200).map((v) => (
            <details key={v.who} className="py-2">
              <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{v.handle ? `@${v.handle}` : `Guest ·${v.who.slice(-4)}`}</span>
                {v.signedUp && <span className="chip chip-on !py-0.5 text-[11px]">signed up</span>}
                <span className="text-xs text-zinc-500">{v.themes.slice(0, 3).map((t) => `${themeLabel(t.theme)} ${t.n}`).join(" · ")}</span>
                <span className="ml-auto text-xs tabular-nums">
                  <b>{v.votes} votes</b> · seen {v.seen} · skipped {v.skips} · left {v.left}
                </span>
              </summary>
              <div className="mt-2 space-y-1 pl-1 text-xs">
                <p className="text-zinc-500">
                  All themes: {v.themes.map((t) => `${themeLabel(t.theme)} ${t.n}`).join(", ")} · last vote {nyTime(v.lastAt)} ·{" "}
                  <Link href={`/admin/journey/person/${encodeURIComponent(v.who)}`} className="text-accent underline-offset-2 hover:underline">
                    Full journey ›
                  </Link>
                </p>
                {v.skipped.length === 0 ? (
                  <p className="text-zinc-500">Skipped nothing.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {v.skipped.map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="w-28 shrink-0 text-zinc-500">Skipped · {themeLabel(b.theme)}</span>
                        <span className="min-w-0 flex-1">{b.slug ? battleLink(b.slug, b.title) : b.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
        {te.voters.length > 200 && <p className="text-xs text-zinc-500">Showing the top 200 of {te.voters.length}.</p>}
      </Section>
    </>
  );
}
