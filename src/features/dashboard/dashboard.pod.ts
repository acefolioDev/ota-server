import { pod } from "@elpod/core";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

export const dashboard = pod({
  name: "dashboard",
  prefix: "/admin",
  controller: DashboardController,
  providers: [DashboardService],
});
