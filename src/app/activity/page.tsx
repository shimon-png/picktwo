import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CheckCircle2, Clock, Heart, ThumbsUp, UserPlus, Users, Zap } from "lucide-react";
import { getCurrentUser } from "@/server/viewer";
import { listNotifications } from "@/server/services/notifications";
import { MarkRead } from "@/components/layout/MarkRead";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

type P = Record<string, unknown>;

function render(type: string, p: P): { icon: React.ReactNode; text: React.ReactNode; href?: string } {
  const title = String(p.title ?? "");
  const slug = p.slug as string | undefined;
  switch (type) {
    case "VOTES_MILESTONE":
      return { icon: <Users className="size-5 text-a" />, text: <><b>{String(p.votes)}</b> {Number(p.votes) === 1 ? "person has" : "people have"} voted on “{title}”</>, href: `/b/${slug}` };
    case "BATTLE_CLOSED":
      return { icon: <Clock className="size-5 text-b" />, text: <>Voting closed on “{title}” — which did you pick? <b>+10 ⚡</b></>, href: `/b/${slug}/report` };
    case "REMINDER":
      return { icon: <Bell className="size-5 text-b" />, text: <>Reminder: close the loop on “{title}”</>, href: `/b/${slug}/report` };
    case "OUTCOME": {
      const picked = p.chosen === "NEITHER" ? "neither option" : `option ${p.chosen}`;
      return { icon: <CheckCircle2 className="size-5 text-ok" />, text: <>{String(p.poster ?? "Someone")} picked {picked} on “{title}” {p.thumb === "UP" ? "👍" : p.thumb === "DOWN" ? "👎" : ""}</>, href: `/b/${slug}` };
    }
    case "CALLED_IT":
      return { icon: <ThumbsUp className="size-5 text-ok" />, text: <>You called it! {String(p.poster ?? "They")} picked your choice on “{title}” and it worked out. <b>+{String(p.points)} ⚡</b></>, href: `/b/${slug}` };
    case "HELPFUL":
      return { icon: <Heart className="size-5 text-b" />, text: <>The poster found your reason helpful. <b>+{String(p.points)} ⚡</b></> };
    case "FOLLOW":
      return { icon: <UserPlus className="size-5 text-a" />, text: <><b>{String(p.name || `@${p.handle}`)}</b> followed you</>, href: p.handle ? `/u/${p.handle}` : undefined };
    default:
      return { icon: <Zap className="size-5 text-pp" />, text: <>{type}</> };
  }
}

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/activity");
  const items = await listNotifications(user.id);
  return (
    <div className="space-y-4">
      <h1 className=" text-2xl font-medium">Activity</h1>
      <MarkRead />
      {items.length === 0 && <div className="card p-6 text-center text-zinc-500">Nothing yet. Post a battle or vote to get things going!</div>}
      <ul className="space-y-2">
        {items.map((n) => {
          const r = render(n.type, n.payload);
          const inner = (
            <div className={`card flex items-start gap-3 p-3 ${!n.readAt ? "border-a/40 bg-a-soft/30" : ""}`}>
              <span className="mt-0.5">{r.icon}</span>
              <div className="flex-1 text-[15px]">
                {r.text}
                <div className="text-xs text-zinc-400">{timeAgo(n.createdAt)}</div>
              </div>
            </div>
          );
          return <li key={n.id}>{r.href ? <Link href={r.href}>{inner}</Link> : inner}</li>;
        })}
      </ul>
    </div>
  );
}
