import type { ElpodElysia } from "@elpod/core";
import { OtaService } from "./ota.service";

export class OtaController {
  static readonly inject = [OtaService] as const;

  constructor(private readonly service: OtaService) {}

  routes(app: ElpodElysia) {
    return app.get("/", () => ({ status: "ok", feature: "ota" }));
  }
}
