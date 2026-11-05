import type { ElpodElysia } from "@elpod/core";

export class AppController {
  routes(app: ElpodElysia) {
    return app.get("/", () => ({
      name: "Elpod",
      message: "Your Elpod application is running.",
    }));
  }
}
