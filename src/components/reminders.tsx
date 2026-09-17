import { useEffect, useState } from "react";
import { maybeNotifyDue, requestNotifyPermission } from "@/lib/teas/notify";
import { useCellar } from "@/lib/teas/use-cellar";
import { Button } from "@/components/ui/button";

export function ReminderWatcher() {
  const { teas, settings, markNotifiedToday } = useCellar();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    maybeNotifyDue(teas, settings.lastNotifiedOn, settings.notify, markNotifiedToday);
  }, [ready, teas, settings.lastNotifiedOn, settings.notify, markNotifiedToday]);

  return null;
}

export function NotifyToggle() {
  const { settings, setNotify } = useCellar();
  const notify = settings.notify;

  async function enable() {
    const ok = await requestNotifyPermission();
    await setNotify(ok);
  }

  if (notify) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => void setNotify(false)}>
        Reminders on
      </Button>
    );
  }

  return (
    <Button type="button" variant="celadon" size="sm" onClick={() => void enable()}>
      Enable reminders
    </Button>
  );
}
