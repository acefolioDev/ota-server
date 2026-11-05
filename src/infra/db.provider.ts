import { db } from "../prisma/db";

export class DbProvider {
  public readonly prisma = db;

  async dispose() {
    await this.prisma.close();
  }
}
