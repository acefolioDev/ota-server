import { render } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import "./style.css";

interface Release {
  id: string;
  appId: string;
  runtimeVersion: string;
  platform: string;
  channel: string;
  rollout: number;
  isActive: boolean;
  createdAt: string;
}

interface AppRecord {
  id: string;
  slug: string;
  projectId: string | null;
  createdAt: string;
  updates: Release[];
}

interface ApiError {
  error?: string;
}

const TOKEN_STORAGE_KEY = "ota-admin-token";

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? "");
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [rollouts, setRollouts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
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
      const response = await fetch("/api/admin/apps", {
        headers: { authorization: `Bearer ${token.trim()}` },
      });
      const payload = (await response.json()) as AppRecord[] | ApiError;
      if (!response.ok) {
        throw new Error(("error" in payload && payload.error) || `Request failed (${response.status})`);
      }
      if (!Array.isArray(payload)) throw new Error("The server returned an invalid apps response.");
      setApps(payload);
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

  async function saveRollout(release: Release) {
    const rollout = rollouts[release.id] ?? release.rollout;
    await runUpdateAction(release.id, async () => {
      await request(`/api/admin/updates/${release.id}/rollout`, {
        method: "PATCH",
        body: JSON.stringify({ rollout }),
      });
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
      await request(`/api/admin/updates/${release.id}/rollback`, { method: "POST" });
      setApps((current) =>
        current.map((app) => ({
          ...app,
          updates: app.updates.map((item) =>
            item.id === release.id ? { ...item, isActive: false } : item,
          ),
        })),
      );
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

  async function request(url: string, init: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${token.trim()}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
    const payload = (await response.json()) as ApiError;
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
  }

  const totalReleases = apps.reduce((count, app) => count + app.updates.length, 0);
  const activeReleases = apps.reduce(
    (count, app) => count + app.updates.filter((release) => release.isActive).length,
    0,
  );

  return (
    <main class="shell">
      <header class="topbar">
        <a class="brand" href="/admin/">
          <span class="brand-mark">O</span>
          <span>OTA Control Center</span>
        </a>
        <button class="button button-quiet" onClick={() => void loadApps()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section class="intro">
        <p class="eyebrow">SELF-HOSTED EXPO UPDATES</p>
        <h1>Ship with confidence.</h1>
        <p class="subtitle">Manage app releases, staged rollouts, and rollbacks from one place.</p>
      </section>

      <section class="auth-panel">
        <label for="admin-token">Admin token</label>
        <div class="token-row">
          <input
            id="admin-token"
            type="password"
            autocomplete="current-password"
            placeholder="OTA_ADMIN_TOKEN"
            value={token}
            onInput={(event) => setToken(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadApps();
            }}
          />
          <button class="button button-primary" onClick={() => void loadApps()} disabled={loading}>
            Connect
          </button>
        </div>
        <p class="hint">Stored only in this browser and sent as a bearer token to this server.</p>
      </section>

      {error && <div class="alert" role="alert">{error}</div>}

      <section class="stats" aria-label="Release overview">
        <Stat label="Applications" value={apps.length} />
        <Stat label="Active releases" value={activeReleases} />
        <Stat label="All releases" value={totalReleases} />
      </section>

      <section class="apps-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">YOUR APPLICATIONS</p>
            <h2>Releases</h2>
          </div>
        </div>

        {loading && apps.length === 0 ? (
          <div class="empty-state">Loading applications…</div>
        ) : apps.length === 0 ? (
          <div class="empty-state">
            <strong>No applications yet</strong>
            <span>Publish an update with the Bun CLI to see it here.</span>
          </div>
        ) : (
          <div class="app-list">
            {apps.map((app) => (
              <article class="app-card" key={app.id}>
                <div class="app-heading">
                  <div>
                    <h3>{app.slug}</h3>
                    <p class="muted">{app.projectId || "No Expo project ID linked"}</p>
                  </div>
                  <span class="count-pill">{app.updates.length} releases</span>
                </div>

                {app.updates.length === 0 ? (
                  <p class="empty-inline">No releases published for this app.</p>
                ) : (
                  <div class="release-list">
                    {app.updates.map((release) => (
                      <div class="release" key={release.id}>
                        <div class="release-main">
                          <div class="release-title">
                            <span class={`platform-icon ${release.platform}`}>
                              {release.platform === "ios" ? "iOS" : "AND"}
                            </span>
                            <strong>{release.runtimeVersion}</strong>
                            <span class={`status ${release.isActive ? "status-active" : "status-inactive"}`}>
                              {release.isActive ? "Active" : "Rolled back"}
                            </span>
                          </div>
                          <p class="release-meta">
                            <span>{release.channel}</span>
                            <span>·</span>
                            <span>{formatDate(release.createdAt)}</span>
                          </p>
                        </div>

                        <div class="rollout-control">
                          <label for={`rollout-${release.id}`}>
                            Rollout <strong>{rollouts[release.id] ?? release.rollout}%</strong>
                          </label>
                          <input
                            id={`rollout-${release.id}`}
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={rollouts[release.id] ?? release.rollout}
                            onInput={(event) =>
                              setRollouts((current) => ({
                                ...current,
                                [release.id]: Number(event.currentTarget.value),
                              }))
                            }
                            disabled={!release.isActive || busyUpdate === release.id}
                          />
                        </div>

                        <div class="release-actions">
                          <button
                            class="button button-secondary"
                            onClick={() => void saveRollout(release)}
                            disabled={!release.isActive || busyUpdate === release.id ||
                              (rollouts[release.id] ?? release.rollout) === release.rollout}
                          >
                            {busyUpdate === release.id ? "Saving…" : "Save rollout"}
                          </button>
                          <button
                            class="button button-danger"
                            onClick={() => void rollback(release)}
                            disabled={!release.isActive || busyUpdate === release.id}
                          >
                            Roll back
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <footer>Expo Updates Protocol v1 · Assets are immutable and content-addressed.</footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article class="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

render(<App />, document.getElementById("app")!);
