import { AdminNav } from "@/components/admin/AdminNav";
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
    // admin-wide: widens <main> past the app's phone-width column on desktop (globals.css), so charts and tables have room.
    <div className="admin-wide space-y-5">
      <AdminNav flagged={flagged} unread={unread} />
      {children}
    </div>
  );
}
