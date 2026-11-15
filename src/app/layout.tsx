import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource-variable/inter";
import "@fontsource/nunito/800.css";
import "./globals.css";
import { getViewer } from "@/server/viewer";
import { linkDevice } from "@/server/services/votes";
import { unreadCount } from "@/server/services/notifications";
import { countOpenLoops } from "@/server/services/points";
import { getEconomy } from "@/server/services/config";
import { Nav } from "@/components/layout/Nav";
import { Logo } from "@/components/layout/Logo";
import { PriorityPill } from "@/components/priority/PriorityPill";
import { Toaster } from "@/components/ui/Toaster";
import { appUrl } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "PickTwo — help me choose", template: "%s · PickTwo" },
  description: "Can't decide? Post two options, get fast votes from people like you, and report back how it went.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PickTwo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, deviceId } = await getViewer();
  let unread = 0;
  let openLoops = 0;
  if (user) {
    if (deviceId) await linkDevice(user.id, deviceId).catch((e) => console.error("[linkDevice]", e));
    [unread, openLoops] = await Promise.all([unreadCount(user.id), getEconomy().then((e) => countOpenLoops(user.id, e))]);
  }
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
          Skip to content
        </a>
        <div className="md:pl-56">
        <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-zinc-50/90 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/90">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <Logo />
            {user ? (
              <PriorityPill initial={user.ppBalance} openLoops={openLoops} />
            ) : (
              <Link href="/signin" className="btn-primary !py-1.5">
                Sign in
              </Link>
            )}
          </div>
        </header>
        <main id="main" className="mx-auto max-w-2xl px-4 pb-28 pt-4 md:pb-12">
          {children}
        </main>
        </div>
        <Nav handle={user?.handle ?? null} unread={unread} />
        <Toaster />
      </body>
    </html>
  );
}
