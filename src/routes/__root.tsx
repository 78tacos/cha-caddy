import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { QueryProvider } from "@/components/query-provider";
import { AppShell } from "@/components/app-shell";
import { ReminderWatcher } from "@/components/reminders";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Cha Caddy";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "A cellar for Chinese tea — track the leaves, the last cup, and what has sat too long.",
      },
      { name: "theme-color", content: "#0e0d0b" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootLayout,
});

function RootLayout() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <QueryProvider>
            <ReminderWatcher />
            <AppShell>
              <Outlet />
            </AppShell>
            <Toaster
              theme="dark"
              position="top-center"
              toastOptions={{
                style: {
                  background: "#171512",
                  color: "#f2ede4",
                  border: "1px solid color-mix(in oklab, #f2ede4 12%, transparent)",
                },
              }}
            />
          </QueryProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
