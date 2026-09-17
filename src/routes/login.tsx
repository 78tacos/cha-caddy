import { useState, type FormEvent } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { GaiwanMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6">
        <div className="h-10 w-48 animate-pulse rounded-md bg-secondary" />
      </main>
    );
  }

  if (user) {
    return <Navigate to="/" />;
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    if (!authEnabled) return;
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0] || "Tea drinker",
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message ?? "Could not create the account.");
      } else {
        const { error } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message ?? "Could not sign in.");
      }
      try {
        await authClient.getSession();
      } catch {
        /* session store will recover on navigation */
      }
      toast.success(mode === "up" ? "Cellar is ready." : "Welcome back.");
      await navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-background px-6 pt-16 pb-28 text-foreground">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
        <header className="space-y-3 text-center">
          <GaiwanMark className="mx-auto size-10 text-celadon" />
          <p className="text-xs tracking-widest text-celadon uppercase">Cha Caddy</p>
          <h1 className="font-display text-4xl leading-none font-medium tracking-tight">
            {mode === "in" ? "Open the cellar" : "Start a cellar"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your teas live online — sign in from any device, then share the cellar with the household.
          </p>
        </header>

        {authEnabled ? (
          <>
            <form onSubmit={onEmail} className="space-y-3">
              {mode === "up" ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground">Name</span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="What to call you"
                  />
                </label>
              ) : null}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium tracking-wide text-muted-foreground">Email</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium tracking-wide text-muted-foreground">Password</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  minLength={8}
                  required
                />
              </label>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "in" ? "No cellar yet?" : "Already have one?"}{" "}
              <button
                type="button"
                className="text-celadon"
                onClick={() => setMode(mode === "in" ? "up" : "in")}
              >
                {mode === "in" ? "Create an account" : "Sign in"}
              </button>
            </p>

            <div className="flex items-center gap-3 text-xs tracking-wide text-muted-foreground uppercase">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Email stays signed in more reliably in this preview. Google opens a popup — if it
              bounces you back here, use email.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}
