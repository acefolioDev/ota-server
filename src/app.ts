import "dotenv/config";
import { application, provideValue, type ElpodContract } from "@elpod/core";
import { app as appFeature } from "@features/app/app.pod";
import { dashboard } from "@features/dashboard/dashboard.pod";
import { ota } from "@features/ota/ota.pod";
import { APP_CONFIG, loadConfig } from "@infra/config";
import { Clock } from "@infra/clock";
import { DbProvider } from "@infra/db.provider";

export const config = loadConfig();

export const app = application({
  features: [appFeature, ota, dashboard],
  providers: [provideValue(APP_CONFIG, config), Clock, DbProvider],
});

/** Import this type from a client package with `import type`; it has no server runtime side effects. */
export type Api = ElpodContract<typeof app>;
