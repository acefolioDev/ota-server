import { formatDate, platformLabel } from "../format";
import type { PendingPublish } from "../types";
import controls from "./controls.module.css";
import styles from "./PendingQueue.module.css";

interface PendingQueueProps {
  items: PendingPublish[];
  busyId: string | null;
  onRetry: (item: PendingPublish) => void;
}

export function PendingQueue({ items, busyId, onRetry }: PendingQueueProps) {
  if (items.length === 0) return null;

  return (
    <section class={styles.section} aria-label="Pending publishes">
      <h2 class={styles.heading}>Unpublished updates</h2>
      <div class={styles.list}>
        {items.map((pending) => (
          <article class={styles.card} key={pending.id}>
            <div>
              <div class={styles.title}>{pending.appSlug} · {pending.runtimeVersion}</div>
              <p class={styles.meta}>
                <span>{platformLabel(pending.platform)}</span>
                <span>{pending.channel}</span>
                <span>{formatDate(pending.createdAt)}</span>
              </p>
              <p class={styles.hint}>Uploaded assets are reused; retry only records the release.</p>
            </div>
            <button
              class={`${controls.button} ${controls.primary}`}
              type="button"
              onClick={() => onRetry(pending)}
              disabled={busyId === pending.id}
            >
              {busyId === pending.id ? "Retrying…" : "Retry publish"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
