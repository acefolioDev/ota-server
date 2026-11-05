#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2b6714ac7b3f61019b73449333b2727da2ec80e260528bd1c0983ee35daa001b/contract';
import endContract from '../../snapshots/2b6714ac7b3f61019b73449333b2727da2ec80e260528bd1c0983ee35daa001b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/3e3ac62d1d6d05fe437ab7a350496278b336b9fb979c9912157d91642ff128b2/contract';
import startContract from '../../snapshots/3e3ac62d1d6d05fe437ab7a350496278b336b9fb979c9912157d91642ff128b2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'apps',
        column: col('project_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'updates',
        column: col('extra', 'text', {
          notNull: true,
          default: lit('{}'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'updates',
        column: col('is_active', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'updates',
        column: col('launch_asset', 'text', {
          notNull: true,
          default: lit('{}'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'updates',
        column: col('metadata', 'text', {
          notNull: true,
          default: lit('{}'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'updates',
        column: col('rollout', 'int4', {
          notNull: true,
          default: lit(100),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'apps',
        constraint: 'apps_project_id_key',
        columns: ['project_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'updates',
        index: 'updates_match_idx',
        columns: ['app_id', 'platform', 'runtime_version', 'channel', 'is_active', 'created_at'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
