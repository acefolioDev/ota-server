import { useCallback, useEffect, useState } from "preact/hooks";
import {
  fetchApps,
  fetchPendingPublishes,
  retryPendingPublish,
  rollbackRelease,
  saveRollout,
} from "./api";
import type { AppRecord, PendingPublish, Release } from "./types";

const TOKEN_STORAGE_KEY = "ota-admin-token";

export function useConsole() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? "");
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [pendingPublishes, setPendingPublishes] = useState<PendingPublish[]>([]);
  const [rollouts, setRollouts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(
    () => Boolean((localStorage.getItem(TOKEN_STORAGE_KEY) ?? "").trim()),
  );
  const [loaded, setLoaded] = useState(false);
  const [busyUpdate, setBusyUpdate] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadApps = useCallback(async () => {
    if (!token.trim()) {
      setError("Enter the server's OTA_ADMIN_TOKEN to load releases.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = await fetchApps(token);
      setApps(payload);
      setLoaded(true);
      const pending = await fetchPendingPublishes(token);
      setPendingPublishes(pending);
      setRollouts(
        Object.fromEntries(
          payload.flatMap((app) => app.updates.map((release) => [release.id, release.rollout])),
        ),
      );
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load releases.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void loadApps();
  }, []);

  function setRollout(releaseId: string, rollout: number) {
    setRollouts((current) => ({ ...current, [releaseId]: rollout }));
  }

  async function saveReleaseRollout(release: Release) {
    const rollout = rollouts[release.id] ?? release.rollout;
    await runUpdateAction(release.id, async () => {
      await saveRollout(token, release.id, rollout);
      setApps((current) =>
        current.map((app) => ({
          ...app,
          updates: app.updates.map((item) =>
            item.id === release.id ? { ...item, rollout } : item,
          ),
        })),
      );
    });
  }

  async function rollback(release: Release) {
    await runUpdateAction(release.id, async () => {
      await rollbackRelease(token, release.id);
      await loadApps();
    });
  }

  async function retryPublish(pending: PendingPublish) {
    await runUpdateAction(pending.id, async () => {
      await retryPendingPublish(token, pending.id);
      setPendingPublishes((current) => current.filter((item) => item.id !== pending.id));
      await loadApps();
    });
  }

  async function runUpdateAction(id: string, action: () => Promise<void>) {
    setBusyUpdate(id);
    setError("");
    try {
      await action();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The update failed.");
    } finally {
      setBusyUpdate(null);
    }
  }

  const totalReleases = apps.reduce((count, app) => count + app.updates.length, 0);
  const activeReleases = apps.reduce(
    (count, app) => count + app.updates.filter((release) => release.isActive).length,
    0,
  );

  return {
    token,
    setToken,
    apps,
    pendingPublishes,
    rollouts,
    setRollout,
    loading,
    busyUpdate,
    error,
    loadApps,
    saveReleaseRollout,
    rollback,
    retryPublish,
    totalReleases,
    activeReleases,
    loaded,
  };
}
