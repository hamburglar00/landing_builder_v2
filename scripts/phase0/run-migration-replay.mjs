// Compatibility entrypoint: the bounded diagnostic supersedes the opaque 180s runner.
// It bootstraps official local Supabase DB, isolates it, and replays every original SQL.
if (!process.argv.includes('--database-only')) process.argv.push('--database-only');
await import('./diagnose-local-start.mjs');
