// Load environment variables from .env before other imports execute.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { initSandlotConfig, SandlotConfigError } from './sandlot/config.js';

// This bootstrap cannot import shared/utils.ts: that module reads environment
// defaults during evaluation, before this file has loaded `.env`.
function getBootstrapApplicationRoot(importMetaUrl: string) {
  const moduleDirectory = path.dirname(fileURLToPath(importMetaUrl));
  let serverRoot = moduleDirectory;
  while (path.basename(serverRoot) !== 'server') {
    const parent = path.dirname(serverRoot);
    if (parent === serverRoot) throw new Error('Could not resolve server root');
    serverRoot = parent;
  }
  const parent = path.dirname(serverRoot);
  return path.basename(parent) === 'dist-server' ? path.dirname(parent) : parent;
}

// Resolve the repo/app root via the nearest /server folder so this file keeps finding the
// same top-level .env file from both /server/load-env.ts and /dist-server/server/load-env.js.
const APP_ROOT = getBootstrapApplicationRoot(import.meta.url);

try {
  const envPath = path.join(APP_ROOT, '.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0 && !process.env[key]) {
        process.env[key] = valueParts.join('=').trim();
      }
    }
  });
} catch (e: any) {
  console.error('No .env file found or error reading it:', e.message);
}

// Sandlot: check the environment contract before any other module is
// evaluated (this file is the server entry's first import), so a bad value
// stops the process before it touches the database, a port or a child process.
try {
  const config = initSandlotConfig();
  // The database module reads DATABASE_PATH; hand it the resolved file path.
  process.env.DATABASE_PATH = config.databasePath;
} catch (error) {
  if (error instanceof SandlotConfigError) {
    console.error(`[FATAL] ${error.message}`);
  } else {
    console.error('[FATAL] Could not read the Sandlot environment contract:', error);
  }
  process.exit(1);
}
