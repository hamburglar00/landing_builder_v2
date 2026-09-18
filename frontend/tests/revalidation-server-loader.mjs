// Node tests have no React client graph. Next enforces the real server-only
// marker during the separate build; here resolve its empty server condition.
import Module, { register } from 'node:module';
import { fileURLToPath } from 'node:url';
// tsx also compiles CommonJS test modules; cover that resolver in this test process.
const original = Module._resolveFilename;
Module._resolveFilename = function(specifier, ...args) {
  if (specifier === 'server-only') return fileURLToPath(new URL('../node_modules/next/dist/compiled/server-only/empty.js', import.meta.url));
  return original.call(this, specifier, ...args);
};
register(new URL('./revalidation-server-resolver.mjs', import.meta.url));
