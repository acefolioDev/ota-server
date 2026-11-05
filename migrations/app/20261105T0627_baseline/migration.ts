#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3e3ac62d1d6d05fe437ab7a350496278b336b9fb979c9912157d91642ff128b2/contract';
import endContract from '../../snapshots/3e3ac62d1d6d05fe437ab7a350496278b336b9fb979c9912157d91642ff128b2/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'apps',
        columns: [
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'updates',
        columns: [
          col('app_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('assets', 'text', {
            notNull: true,
            default: lit('[]'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('bundle_url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('channel', 'text', {
            notNull: true,
            default: lit('production'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('platform', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('runtime_version', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'apps',
        constraint: 'apps_slug_key',
        columns: ['slug'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'updates',
        index: 'updates_app_id_idx_1cf06460',
        columns: ['app_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'updates',
        foreignKey: {
          name: 'updates_app_id_fkey',
          columns: ['app_id'],
          references: { schema: 'public', table: 'apps', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
