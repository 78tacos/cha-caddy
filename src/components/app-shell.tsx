import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Clock, LayoutGrid, Plus, Users } from "lucide-react";
import { GaiwanMark } from "@/components/mark";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { authClient, getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { selectReminderTeas } from "@/lib/teas/store";
import { useCellar } from "@/lib/teas/use-cellar";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Cellar", icon: LayoutGrid, exact: true },
  { to: "/resting", label: "Resting", icon: Clock, exact: false },
  { to: "/log", label: "Log", icon: BookOpen, exact: false },
  { to: "/new", label: "Add", icon: Plus, exact: false },
] as const;

/**
 * Live-preview Google/X sign-in stores a bearer in sessionStorage. A getSession
 * refetch that races the token, or a brief iframe remount, looks like a sign-out.
 * Hold the shell open and retry while the bearer is still here.
 */
function useBearerSessionHold(user: unknown, isPending: boolean): boolean {
  const bearerHere =
    typeof window !== "undefined" && Boolean(getBearerToken());
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (user) {
      setGaveUp(false);
      return;
    }
    if (isPending) return;
    const token = getBearerToken();
    if (!token) {
      setGaveUp(true);
      return;
    }
    let cancelled = false;
    setGaveUp(false);
    void (async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await authClient.getSession();
        } catch {
          /* retry */
        }
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 280));
      }
      if (!cancelled) setGaveUp(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isPending]);

  useEffect(() => {
    const refresh = () => {
      if (getBearerToken()) void authClient.getSession();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return Boolean(!user && !isPending && bearerHere && !gaveUp);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const holding = useBearerSessionHold(user, isPending);
  const { teas, cellar, switchCellar } = useCellar();
  const due = selectReminderTeas(teas, 5).length;
  const shelves = cellar?.memberships ?? [];
  const isLogin = pathname === "/login";

  if (isLogin) return <>{children}</>;

  if (isPending || holding) {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <GaiwanMark className="size-6 text-celadon" />
              <span className="font-display text-lg font-medium tracking-tight">Cha Caddy</span>
            </div>
            <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28">
          <p className="text-xs tracking-widest text-celadon uppercase">Cellar</p>
          <p className="mt-2 font-display text-3xl">Opening the cellar…</p>
          <div className="mt-6 h-40 animate-pulse rounded-xl bg-card" />
        </main>
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)]"
          aria-hidden="true"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-4">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <span className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs tracking-wide text-muted-foreground">
                    <Icon className="size-5" strokeWidth={1.6} />
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    );
  }

  if (!user) return <RedirectToSignIn />;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-foreground">
            <GaiwanMark className="size-6 text-celadon" />
            <span className="font-display text-lg font-medium tracking-tight">Cha Caddy</span>
            <span className="text-[10px] text-muted-foreground/45">v1.6</span>
          </Link>
          <div className="flex min-w-0 items-center gap-0.5">
            {shelves.length > 1 ? (
              <label className="sr-only" htmlFor="shelf-switch">
                Switch cellar
              </label>
            ) : null}
            {shelves.length > 1 ? (
              <select
                id="shelf-switch"
                value={cellar?.id}
                onChange={(e) => void switchCellar(e.target.value)}
                className="mr-1 max-w-28 truncate rounded-md bg-transparent py-1 text-xs text-muted-foreground"
              >
                {shelves.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Link
              to="/share"
              aria-label="Share cellar"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-md",
                pathname === "/share" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Users className="size-5" strokeWidth={pathname === "/share" ? 2 : 1.6} />
            </Link>
            <div className="account-chip min-w-0">
              <UserButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
        aria-label="Primary"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs tracking-wide",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2 : 1.6} />
                  {item.label}
                  {item.to === "/resting" && due > 0 ? (
                    <span className="absolute top-1.5 ml-6 flex size-4 items-center justify-center rounded-full bg-celadon text-xs font-medium text-celadon-fg tabular-nums">
                      {due > 9 ? "9+" : due}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
