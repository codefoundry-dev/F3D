#!/usr/bin/env node
// Mirrors compiled .js (and .js.map) from dist/ into src/ at the same relative
// paths. The @nestjs/swagger CLI plugin emits relative require() calls into the
// backend's compiled controllers pointing at TS source locations under
// packages/shared-types/src/...; without a sibling .js, Node throws
// MODULE_NOT_FOUND at boot. The runtime layout Docker builds via two COPYs is
// reproduced here so local dev (`pnpm dev`) and CI work identically.

const fs = require('node:fs');
const path = require('node:path');

const PKG_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(PKG_ROOT, 'src');
const DIST = path.join(PKG_ROOT, 'dist');
const MIRRORED_EXT = ['.js', '.js.map'];

if (!fs.existsSync(DIST)) {
  console.error(`mirror-dist-to-src: ${DIST} not found — run \`tsc\` first.`);
  process.exit(1);
}

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

walk(SRC, (file) => {
  if (MIRRORED_EXT.some((ext) => file.endsWith(ext))) fs.unlinkSync(file);
});

walk(DIST, (file) => {
  if (!MIRRORED_EXT.some((ext) => file.endsWith(ext))) return;
  const dest = path.join(SRC, path.relative(DIST, file));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
});
