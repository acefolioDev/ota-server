import postgres from "@prisma/orm-postgres/runtime";
import { APP_CONFIG, type AppConfig } from "./config";
import { contract } from "../prisma/db";

export class DbProvider {
  static readonly needs = [APP_CONFIG] as const;

  public readonly prisma;

  constructor(config: AppConfig) {
    this.prisma = postgres({
      contract,
      url: config.databaseUrl,
    });
  }

  async dispose() {
    await this.prisma.close();
  }
}
