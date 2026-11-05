# Prisma 8 Setup

The app's data contract is [`src/prisma/contract.prisma`](src/prisma/contract.prisma). It defines the PostgreSQL `App` and `Update` models and is the source of truth for the generated contract types and runtime.

## Configure PostgreSQL

Use PostgreSQL 15 or newer. Copy `.env.example` to `.env` and set `DATABASE_URL` to the connection string for your database. The Prisma CLI reads it through `prisma.config.ts`, and the runtime loads it through `src/prisma/db.ts`.

## Database workflow

```bash
bun run contract:emit # Regenerate contract.json and contract.d.ts after editing the contract
bun run db:init        # Apply the contract to a new database
bun run db:update      # Update a development database to match the contract
bun run db:verify      # Check that the database matches the contract
bun run db:status      # Show migration status
bun run typecheck      # Type-check the application
```

`db:init` and `db:update` change the target database. Review `DATABASE_URL` before running them. Use migration planning and `db migrate` for schema changes that need a reviewed migration history.

## Runtime

Import the shared typed client from `src/prisma/db.ts`:

```typescript
import { db } from './prisma/db';

const app = await db.orm.public.App.create({ slug: 'my-app' });
const updates = await db.orm.public.Update.where({ appId: app.id }).all();
```

`contract.json` and `contract.d.ts` are generated artifacts; edit `contract.prisma` and run `bun run contract:emit` instead of editing them directly.
