import type { ElpodElysia } from "@elpod/core";
import { DashboardService } from "./dashboard.service";

export class DashboardController {
  static readonly needs = [DashboardService] as const;

  constructor(private readonly dashboard: DashboardService) {}

  routes(app: ElpodElysia) {
    return app
      .get("/", () => this.dashboard.serve("index.html"))
      .get("/*", ({ request }) => {
        const path = new URL(request.url).pathname.slice("/admin/".length);
        return this.dashboard.serve(path);
      });
  }
}
