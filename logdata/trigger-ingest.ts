// Sends the same request n8n sends every morning, so /api/ingest can be tested without n8n.
// Run: npx tsx --env-file=.env.local logdata/trigger-ingest.ts [baseUrl]
// baseUrl defaults to APP_BASE_URL, then http://localhost:3000.
// No Gemini here, and boards fetched in the last 20 h are skipped, so running it twice is safe.

async function main() {
  const base = process.argv[2] ?? process.env.APP_BASE_URL ?? "http://localhost:3000";
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    console.error("INGEST_SECRET is not set. Add it to .env.local (same value as in Vercel and n8n).");
    process.exit(1);
  }

  const url = new URL("/api/ingest", base);
  const started = Date.now();
  const res = await fetch(url, { method: "POST", headers: { "x-ingest-secret": secret } });
  const body = await res.text();
  console.log(`${res.status} from ${url} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(body);

  if (!res.ok) {
    if (res.status === 403) console.error("Secret mismatch: INGEST_SECRET here differs from the server's.");
    if (res.status === 404) console.error("No /api/ingest route yet (T2), or wrong base URL.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
