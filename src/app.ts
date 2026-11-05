import { application, type ElpodContract } from "@elpod/core";
import { app as appFeature } from "@features/app/app.pod";
import { ota } from "@features/ota/ota.pod";
import { Clock } from "@infra/clock";
import { DbProvider } from "@infra/db.provider";

export const app = application({
  features: [appFeature,ota],
  providers: [Clock, DbProvider],
});

/** Import this type from a client package with `import type`; it has no server runtime side effects. */
export type Api = ElpodContract<typeof app>;
