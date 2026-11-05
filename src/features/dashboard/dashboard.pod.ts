import { pod } from "@elpod/core";
import { DashboardController } from "./dashboard.controller";

export const dashboard = pod({
  name: "dashboard",
  prefix: "/admin",
  controller: DashboardController,
});
