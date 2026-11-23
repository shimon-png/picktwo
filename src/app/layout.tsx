import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource-variable/inter";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import { ThemePreview } from "@/components/layout/ThemePreview";
import { DEFAULT_THEME, themeBootScript } from "@/lib/theme-preview";
import "./globals.css";
import { getViewer } from "@/server/viewer";
import { linkDevice } from "@/server/services/votes";
import { unreadCount } from "@/server/services/notifications";
import { unreadMessageCount } from "@/server/services/messages";
import { MessagesButton } from "@/components/messages/MessagesButton";
import { countOpenLoops } from "@/server/services/points";
import { getEconomy } from "@/server/services/config";
import { Nav, ChromeOnly, ContentShell, HeaderLogo, YouButton } from "@/components/layout/Nav";
import { PriorityPill } from "@/components/priority/PriorityPill";
import { Toaster } from "@/components/ui/Toaster";
import { XPixel } from "@/components/analytics/XPixel";
import { Telemetry } from "@/components/layout/Telemetry";
import { appUrl } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "crowdpick.ai — can't decide? Ask people like you.", template: "%s · crowdpick.ai" },
  description: "Can't decide? Post two options, get fast votes from friends and people like you, and tell everyone how it went.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "crowdpick", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#120e26",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, deviceId } = await getViewer();
  let unread = 0;
  let unreadDms = 0;
  let openLoops = 0;
  const economy = await getEconomy();
  if (user) {
    if (deviceId) await linkDevice(user.id, deviceId).catch((e) => console.error("[linkDevice]", e));
    [unread, openLoops, unreadDms] = await Promise.all([unreadCount(user.id), countOpenLoops(user.id, economy), unreadMessageCount(user.id)]);
  }
  return (
    <html lang="en" data-theme={DEFAULT_THEME === "prompt" ? undefined : DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <ThemePreview />
        <Telemetry />
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
          Skip to content
        </a>
        <ContentShell>
          <ChromeOnly>
            <header className="sticky top-0 z-30 border-b border-ink/10 bg-page/95 backdrop-blur">
              <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-2 px-4">
                <HeaderLogo />
                {user ? (
                  <>
                    {/* ⚡ sits in the middle of the bar; You (avatar + alerts) is top right. */}
                    <div data-tour="account" className="flex flex-1 justify-center">
                      <PriorityPill initial={user.ppBalance} openLoops={openLoops} highAt={economy.tierHighAt} topAt={economy.tierTopAt} />
                    </div>
                    <MessagesButton unread={unreadDms} />
                    <YouButton name={user.name || user.handle || "?"} image={user.image} unread={unread} />
                  </>
                ) : (
                  <div data-tour="account">
                    <Link href="/signin" className="btn-outline !px-3 !py-1.5 text-sm">
                      Sign in
                    </Link>
                  </div>
                )}
              </div>
            </header>
          </ChromeOnly>
          <main id="main" className="mx-auto max-w-2xl px-4 pb-28 pt-2 md:pb-12">
            {children}
          </main>
        </ContentShell>
        <Nav />
        <Toaster />
        <XPixel />
      </body>
    </html>
  );
}
