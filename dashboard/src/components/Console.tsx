import { useConsole } from "../use-console";
import controls from "./controls.module.css";
import styles from "./Console.module.css";
import { Overview } from "./Overview";
import { PendingQueue } from "./PendingQueue";
import { ReleaseBoard } from "./ReleaseBoard";
import { Sidebar } from "./Sidebar";

export function Console() {
  const consoleState = useConsole();

  return (
    <div class={styles.frame}>
      <Sidebar
        token={consoleState.token}
        pendingCount={consoleState.pendingPublishes.length}
        loading={consoleState.loading}
        onTokenChange={consoleState.setToken}
        onConnect={() => void consoleState.loadApps()}
      />
      <main class={styles.main}>
        <header class={styles.header}>
          <div>
            <h1>Releases</h1>
            <p class={styles.lede}>Stage rollouts and roll back runtime updates.</p>
          </div>
          <button
            class={`${controls.button} ${controls.quiet}`}
            type="button"
            onClick={() => void consoleState.loadApps()}
            disabled={consoleState.loading}
          >
            {consoleState.loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {consoleState.error && <div class={styles.alert} role="alert">{consoleState.error}</div>}

        {consoleState.loaded ? (
          <>
            <Overview
              applications={consoleState.apps.length}
              activeReleases={consoleState.activeReleases}
              totalReleases={consoleState.totalReleases}
            />
            <PendingQueue
              items={consoleState.pendingPublishes}
              busyId={consoleState.busyUpdate}
              onRetry={(pending) => void consoleState.retryPublish(pending)}
            />
            <ReleaseBoard
              apps={consoleState.apps}
              rollouts={consoleState.rollouts}
              busyId={consoleState.busyUpdate}
              onRolloutChange={consoleState.setRollout}
              onSaveRollout={(release) => void consoleState.saveReleaseRollout(release)}
              onRollback={(release) => void consoleState.rollback(release)}
            />
          </>
        ) : (
          <div class={styles.gate}>
            {consoleState.loading ? "Loading applications…" : "Connect with the admin token to load releases."}
          </div>
        )}
        <footer class={styles.footer}>Expo Updates Protocol v1 · Assets are immutable and content-addressed.</footer>
      </main>
    </div>
  );
}
