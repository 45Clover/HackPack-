import postgres from "postgres";

// Reuse one client across hot reloads in dev, so we don't open new connections on every save.
const g = globalThis as unknown as { sql?: postgres.Sql };
export const sql = (g.sql ??= postgres(process.env.DATABASE_URL!, { ssl: "require", max: 5 }));
