import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/server/viewer";

export const dynamic = "force-dynamic";

/**
 * /admin opens the Brain (Alex, Nov 26 2026: the old Metrics page was out of date and is gone). The admin check is
 * repeated here so a non-admin still gets a 404, not a redirect that reveals the admin pages exist.
 */
export default async function AdminHome() {
  if (!isAdmin(await getCurrentUser())) notFound();
  redirect("/admin/brain");
}
