import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/server/viewer";
import { unreadContactCount } from "@/server/services/contact";
import { openReportCount } from "@/server/services/reports";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await getCurrentUser();
  if (!isAdmin(u)) notFound();
  const [unread, flagged] = await Promise.all([unreadContactCount(), openReportCount()]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-medium">Admin</h1>
        <Link href="/admin" className="chip">Metrics</Link>
        <Link href="/admin/brain" className="chip">Brain</Link>
        <Link href="/admin/journey" className="chip">Journey</Link>
        <Link href="/admin/finance" className="chip">Finance</Link>
        <Link href="/admin/reports" className="chip">
          Moderation
          {flagged > 0 && <span className="ml-1.5 rounded-full bg-b px-1.5 text-[11px] text-white">{flagged}</span>}
        </Link>
        <Link href="/admin/battles" className="chip">Battles</Link>
        <Link href="/admin/messages" className="chip">
          Messages
          {unread > 0 && <span className="ml-1.5 rounded-full bg-b px-1.5 text-[11px] text-white">{unread}</span>}
        </Link>
        <Link href="/admin/config" className="chip">Config</Link>
        <a href="/api/admin/export" className="chip">Export JSONL</a>
      </div>
      {children}
    </div>
  );
}
