import { randomUUID } from "node:crypto";
import { DbProvider } from "@infra/db.provider";
import { releaseWasSupersededByRollback, selectRollbackTarget } from "./ota.utils";

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
    return this.database.prisma.transaction(async (tx) => {
      const updates = tx.orm.public.Update;
      const current = await updates.where({ id: updateId }).forUpdate().first();
      if (!current?.isActive) return current;

      const active = await updates
        .where({
          appId: current.appId,
          runtimeVersion: current.runtimeVersion,
          platform: current.platform,
          channel: current.channel,
          isActive: true,
        })
        .forUpdate()
        .all();
      const target = selectRollbackTarget(current, active);
      await updates.where({ id: current.id }).update({ isActive: false });
      if (target) await promoteExistingRelease(updates, target.id);
      return { ...current, isActive: false };
    });
  }

  async promoteRestoredRelease<T extends ChannelRelease>(release: T): Promise<T> {
    const rolledBack = await this.database.prisma.orm.public.Update
      .where({
        appId: release.appId,
        runtimeVersion: release.runtimeVersion,
        platform: release.platform,
        channel: release.channel,
        isActive: false,
      })
      .select("createdAt")
      .all();
    if (!releaseWasSupersededByRollback(release, rolledBack)) return release;

    const promoted = await promoteExistingRelease(this.database.prisma.orm.public.Update, release.id);
    return promoted ? { ...release, ...promoted } : release;
  }
}

interface ChannelRelease {
  id: string;
  appId: string;
  runtimeVersion: string;
  platform: string;
  channel: string;
  createdAt: Date;
}

type UpdateCollection = {
  where(filter: { id: string }): {
    update(data: { id: string; createdAt: Date; isActive: boolean }): Promise<ChannelRelease | null>;
  };
};

function promoteExistingRelease(updates: UpdateCollection, releaseId: string) {
  return updates.where({ id: releaseId }).update({
    id: randomUUID(),
    createdAt: new Date(),
    isActive: true,
  });
}
