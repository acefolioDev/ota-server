import { DbProvider } from "@infra/db.provider";

interface UpdateRecord {
  appId: string;
  runtimeVersion: string;
  platform: string;
  channel: string;
  bundleUrl: string;
  launchAsset: string;
  assets: string;
  metadata: string;
  extra: string;
  rollout: number;
  isActive: boolean;
}

export class OtaRepo {
  static readonly needs = [DbProvider] as const;

  constructor(private readonly database: DbProvider) {}

  findAppBySlug(slug: string) {
    return this.database.prisma.orm.public.App.where({ slug }).first();
  }

  findAppByProjectId(projectId: string) {
    return this.database.prisma.orm.public.App.where({ projectId }).first();
  }

  listAppIdentities() {
    return this.database.prisma.orm.public.App.select("id", "slug", "projectId").all();
  }

  listActiveUpdates(input: {
    appId: string;
    runtimeVersion: string;
    platform: string;
    channel: string;
  }) {
    return this.database.prisma.orm.public.Update
      .where({
        appId: input.appId,
        runtimeVersion: input.runtimeVersion,
        platform: input.platform,
        channel: input.channel,
        isActive: true,
      })
      .orderBy((update) => update.createdAt.desc())
      .all();
  }

  listApps() {
    return this.database.prisma.orm.public.App
      .select("id", "slug", "projectId", "createdAt")
      .all();
  }

  listUpdates() {
    return this.database.prisma.orm.public.Update
      .select(
        "id",
        "appId",
        "runtimeVersion",
        "platform",
        "channel",
        "rollout",
        "isActive",
        "createdAt",
      )
      .orderBy((update) => update.createdAt.desc())
      .all();
  }

  upsertApp(slug: string, projectId: string | null) {
    return this.database.prisma.orm.public.App
      .where({ slug })
      .upsert({
        create: { slug, projectId },
        update: projectId ? { projectId } : {},
        conflictOn: { slug },
      });
  }

  upsertUpdate(id: string, data: UpdateRecord) {
    return this.database.prisma.orm.public.Update
      .where({ id })
      .upsert({
        create: { id, ...data },
        update: data,
        conflictOn: { id },
      });
  }

  async setRollout(updateId: string, rollout: number) {
    const updated = await this.database.prisma.orm.public.Update
      .where({ id: updateId })
      .update({ rollout });
    return updated ?? null;
  }

  async rollback(updateId: string) {
    const updated = await this.database.prisma.orm.public.Update
      .where({ id: updateId })
      .update({ isActive: false });
    return updated ?? null;
  }
}
