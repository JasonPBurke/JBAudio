#!/usr/bin/env node
// Runs `eas build --local` with SENTRY_AUTH_TOKEN pulled from .env.local and
// injected only into this subprocess's environment. Gradle reads the OS env
// directly (it does not read .env.local), and without the token both the
// R8 mapping upload and the JS sourcemap upload silently/loudly skip or fail.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envLocalPath = path.join(__dirname, '..', '.env.local');
const envLocal = fs.readFileSync(envLocalPath, 'utf8');
const match = envLocal.match(/^SENTRY_AUTH_TOKEN=(.*)$/m);

if (!match) {
  console.error('SENTRY_AUTH_TOKEN not found in .env.local — aborting local build.');
  process.exit(1);
}

const profile = process.argv[2] || 'preview';

const result = spawnSync(
  'eas',
  ['build', '--platform', 'android', '--profile', profile, '--local'],
  {
    stdio: 'inherit',
    env: { ...process.env, SENTRY_AUTH_TOKEN: match[1].trim() },
  }
);

process.exit(result.status ?? 1);
