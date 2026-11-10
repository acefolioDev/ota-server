import { useState } from "preact/hooks";
import { formatDate, platformLabel } from "../format";
import type { AppRecord, Release } from "../types";
import controls from "./controls.module.css";
import styles from "./ReleaseBoard.module.css";

const PAGE_SIZE = 10;

interface ReleaseBoardProps {
  apps: AppRecord[];
  rollouts: Record<string, number>;
  busyId: string | null;
  onRolloutChange: (releaseId: string, rollout: number) => void;
  onSaveRollout: (release: Release) => void;
  onRollback: (release: Release) => void;
}

export function ReleaseBoard({
  apps,
  rollouts,
  busyId,
  onRolloutChange,
  onSaveRollout,
  onRollback,
}: ReleaseBoardProps) {
  const [pages, setPages] = useState<Record<string, number>>({});

  return (
    <section class={styles.board}>
      <div class={styles.heading}>
        <h2>Applications</h2>
      </div>
      {apps.length === 0 ? (
        <div class={styles.empty}>
          <strong>No applications yet</strong>
          <span>Publish an update with the Bun CLI to see it here.</span>
        </div>
      ) : (
        <div class={styles.list}>
          {apps.map((app) => {
            const pageCount = Math.max(1, Math.ceil(app.updates.length / PAGE_SIZE));
            const page = Math.min(pages[app.id] ?? 0, pageCount - 1);
            const start = page * PAGE_SIZE;
            const visible = app.updates.slice(start, start + PAGE_SIZE);
            return (
              <article class={styles.card} key={app.id}>
                <header class={styles.appHeading}>
                  <div>
                    <h3>{app.slug}</h3>
                    <p class={styles.project}>{app.projectId || "No Expo project ID linked"}</p>
                  </div>
                  <span class={styles.count}>{app.updates.length} releases</span>
                </header>
                {app.updates.length === 0 ? (
                  <p class={styles.emptyInline}>No releases published for this app.</p>
                ) : (
                  <div class={styles.rows}>
                    {visible.map((release) => (
                      <ReleaseRow
                        key={release.id}
                        release={release}
                        rollout={rollouts[release.id] ?? release.rollout}
                        busy={busyId === release.id}
                        onRolloutChange={onRolloutChange}
                        onSaveRollout={onSaveRollout}
                        onRollback={onRollback}
                      />
                    ))}
                  </div>
                )}
                {app.updates.length > PAGE_SIZE && (
                  <div class={styles.pager}>
                    <span>{start + 1}–{start + visible.length} of {app.updates.length}</span>
                    <div class={styles.pagerActions}>
                      <button
                        class={`${controls.button} ${controls.quiet}`}
                        type="button"
                        disabled={page === 0}
                        onClick={() => setPages((current) => ({ ...current, [app.id]: page - 1 }))}
                      >
                        Previous
                      </button>
                      <button
                        class={`${controls.button} ${controls.quiet}`}
                        type="button"
                        disabled={page >= pageCount - 1}
                        onClick={() => setPages((current) => ({ ...current, [app.id]: page + 1 }))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ReleaseRow({
  release,
  rollout,
  busy,
  onRolloutChange,
  onSaveRollout,
  onRollback,
}: {
  release: Release;
  rollout: number;
  busy: boolean;
  onRolloutChange: (releaseId: string, rollout: number) => void;
  onSaveRollout: (release: Release) => void;
  onRollback: (release: Release) => void;
}) {
  const unchanged = rollout === release.rollout;
  return (
    <div class={styles.release}>
      <div>
        <div class={styles.title}>
          <span class={`${styles.platform} ${release.platform === "android" ? styles.android : ""}`}>
            {platformLabel(release.platform)}
          </span>
          <span class={styles.version}>{release.runtimeVersion}</span>
          <span class={`${styles.status} ${release.isActive ? styles.active : styles.inactive}`}>
            {release.isActive ? "Active" : "Rolled back"}
          </span>
        </div>
        <p class={styles.meta}>
          <span>{release.channel}</span>
          <span>{formatDate(release.createdAt)}</span>
        </p>
      </div>
      <div class={styles.rollout}>
        <label for={`rollout-${release.id}`}>
          <span>Rollout</span>
          <strong>{rollout}%</strong>
        </label>
        <input
          id={`rollout-${release.id}`}
          class={styles.range}
          type="range"
          min="0"
          max="100"
          step="1"
          value={rollout}
          onInput={(event) => onRolloutChange(release.id, Number(event.currentTarget.value))}
          disabled={!release.isActive || busy}
        />
      </div>
      <div class={styles.actions}>
        <button
          class={`${controls.button} ${controls.quiet}`}
          type="button"
          onClick={() => onSaveRollout(release)}
          disabled={!release.isActive || busy || unchanged}
        >
          {busy ? "Saving…" : "Save rollout"}
        </button>
        <button
          class={`${controls.button} ${controls.danger}`}
          type="button"
          onClick={() => onRollback(release)}
          disabled={!release.isActive || busy}
        >
          Roll back
        </button>
      </div>
    </div>
  );
}
