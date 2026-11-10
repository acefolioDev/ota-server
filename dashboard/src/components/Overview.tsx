import styles from "./Overview.module.css";

interface OverviewProps {
  applications: number;
  activeReleases: number;
  totalReleases: number;
}

export function Overview({ applications, activeReleases, totalReleases }: OverviewProps) {
  return (
    <section class={styles.stats} aria-label="Release overview">
      <Stat label="Applications" value={applications} />
      <Stat label="Active releases" value={activeReleases} />
      <Stat label="All releases" value={totalReleases} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article class={styles.card}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
