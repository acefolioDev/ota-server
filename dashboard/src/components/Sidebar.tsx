import type { Theme } from "../use-theme";
import controls from "./controls.module.css";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  token: string;
  pendingCount: number;
  loading: boolean;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onTokenChange: (value: string) => void;
  onConnect: () => void;
}

export function Sidebar({
  token,
  pendingCount,
  loading,
  theme,
  onThemeChange,
  onTokenChange,
  onConnect,
}: SidebarProps) {
  return (
    <aside class={styles.sidebar}>
      <a class={styles.brand} href="/admin/">
        <span class={styles.mark}>OTA</span>
        <span class={styles.brandText}>
          <span class={styles.product}>Control Center</span>
          <span class={styles.productSub}>Self-hosted Expo updates</span>
        </span>
      </a>

      <div class={styles.themes} role="group" aria-label="Color theme">
        <button
          class={theme === "light" ? styles.themeOn : styles.themeOff}
          type="button"
          aria-pressed={theme === "light"}
          onClick={() => onThemeChange("light")}
        >
          Light
        </button>
        <button
          class={theme === "dark" ? styles.themeOn : styles.themeOff}
          type="button"
          aria-pressed={theme === "dark"}
          onClick={() => onThemeChange("dark")}
        >
          Dark
        </button>
      </div>

      <nav class={styles.nav} aria-label="Sections">
        <div class={styles.navItem}>
          <span>Releases</span>
          {pendingCount > 0 && <span class={styles.badge}>{pendingCount}</span>}
        </div>
      </nav>
      <p class={styles.note}>Runtime updates published to this server.</p>

      <form
        class={styles.session}
        onSubmit={(event) => {
          event.preventDefault();
          onConnect();
        }}
      >
        <h2>Admin session</h2>
        <label class={styles.label} for="admin-token">Admin token</label>
        <input
          id="admin-token"
          class={controls.field}
          type="password"
          autocomplete="current-password"
          placeholder="OTA_ADMIN_TOKEN"
          value={token}
          onInput={(event) => onTokenChange(event.currentTarget.value)}
        />
        <button class={`${controls.button} ${controls.primary}`} type="submit" disabled={loading}>
          Connect
        </button>
        <p class={styles.hint}>Stored only in this browser and sent as a bearer token to this server.</p>
      </form>
    </aside>
  );
}
