import { timingSafeEqual } from "node:crypto";
import { APP_CONFIG, type AppConfig } from "@infra/config";
import { OtaRepo } from "./ota.repo";

export class OtaAdminService {
  static readonly needs = [OtaRepo, APP_CONFIG] as const;

  constructor(
    private readonly repo: OtaRepo,
    private readonly config: AppConfig,
  ) {}

  async listApps() {
    const apps = await this.repo.listApps();
    const updates = await this.repo.listUpdates();
    return apps
      .map((app) => ({
        ...app,
        updates: updates
          .filter((update) => update.appId === app.id)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
      }))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  setRollout(updateId: string, rollout: number) {
    return this.repo.setRollout(updateId, rollout);
  }

  rollback(updateId: string) {
    return this.repo.rollback(updateId);
  }

  authorizeAdmin(authorization: string | undefined): "authorized" | "unauthorized" {
    const expected = this.config.adminToken;
    if (!authorization?.startsWith("Bearer ")) return "unauthorized";

    const actual = Buffer.from(authorization.slice("Bearer ".length));
    const expectedBytes = Buffer.from(expected);
    if (actual.byteLength !== expectedBytes.byteLength || !timingSafeEqual(actual, expectedBytes)) {
      return "unauthorized";
    }
    return "authorized";
  }
}
