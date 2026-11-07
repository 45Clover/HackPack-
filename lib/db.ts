import postgres from "postgres";

// Neon: use the *pooled* connection string. prepare:false because the pooler runs in transaction mode.
// Reuse one client across hot reloads in dev, so we don't open new connections on every save.
const g = globalThis as unknown as { sql?: postgres.Sql };
export const sql = (g.sql ??= postgres(process.env.DATABASE_URL!, { ssl: "require", max: 5, prepare: false }));
