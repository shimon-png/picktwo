import Link from "next/link";
import { battleCounts, listAdminBattles, type AdminBattleFilter } from "@/server/services/admin-battles";
import { getEconomy } from "@/server/services/config";
import { BattleRelauncher } from "@/components/admin/BattleRelauncher";
import { AutoSeedPanel } from "@/components/admin/AutoSeedPanel";
import { autoSeedStatus } from "@/server/services/auto-seed";

const TABS: [AdminBattleFilter, string][] = [
  ["ended", "Ended"],
  ["live", "Live"],
  ["all", "All"],
];

export default async function AdminBattles({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status: raw, q = "" } = await searchParams;
  const filter = (TABS.find(([k]) => k === raw)?.[0] ?? "ended") as AdminBattleFilter;
  const [counts, rows, economy, seed] = await Promise.all([battleCounts(), listAdminBattles(filter, q), getEconomy(), autoSeedStatus()]);
  const tiles: [string, number][] = [
    ["All battles", counts.total],
    ["Live now", counts.live],
    ["Ended", counts.ended],
    ["Ended, can relaunch", counts.relaunchable],
    ["Decided (outcome in)", counts.decided],
    ["Hidden", counts.hidden],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="text-xs text-zinc-500">{k}</div>
            <div className="text-2xl font-medium">{v}</div>
          </div>
        ))}
      </div>
      <AutoSeedPanel s={seed} />
      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/battles?status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`chip !py-1 text-xs ${k === filter ? "chip-on" : ""}`}>
            {label}
          </Link>
        ))}
        <form className="ml-auto" action="/admin/battles">
          <input type="hidden" name="status" value={filter} />
          <input name="q" defaultValue={q} placeholder="Search title or @user" className="input !py-1 text-sm" />
        </form>
      </div>
      <BattleRelauncher
        key={`${filter}:${q}`}
        rows={rows.map((r) => ({ ...r, deadline: r.deadline.toISOString(), createdAt: r.createdAt.toISOString() }))}
        relaunchableEnded={counts.relaunchable}
        maxHours={economy.maxBattleHours}
      />
    </div>
  );
}
