import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createHeartbeatFileTracker, touchHeartbeatFile } from '@/sandlot/heartbeat.js';

function fakeScheduler() {
  const timers = new Map<number, () => void>();
  let next = 1;
  return {
    timers,
    scheduler: {
      setInterval: ((callback: () => void) => {
        const id = next++;
        timers.set(id, callback);
        return id;
      }) as unknown as typeof setInterval,
      clearInterval: ((id: number) => {
        timers.delete(id);
      }) as unknown as typeof clearInterval,
    },
  };
}

test('touches at once on the first client, on every tick while held, and stops at zero', () => {
  const touched: string[] = [];
  const { timers, scheduler } = fakeScheduler();
  const tracker = createHeartbeatFileTracker('/tmp/hb', { scheduler, touch: (file) => touched.push(file) });

  const releaseA = tracker.acquire();
  assert.equal(touched.length, 1);
  assert.equal(timers.size, 1);
  const releaseB = tracker.acquire();
  assert.equal(timers.size, 1, 'one interval for all clients');
  [...timers.values()][0]();
  assert.equal(touched.length, 2);

  releaseA();
  releaseA();
  assert.equal(tracker.activeClients, 1);
  assert.equal(timers.size, 1);
  releaseB();
  assert.equal(tracker.activeClients, 0);
  assert.equal(timers.size, 0);
});

test('without CLOUDCLI_HEARTBEAT_FILE nothing is touched', () => {
  const touched: string[] = [];
  const { timers, scheduler } = fakeScheduler();
  const tracker = createHeartbeatFileTracker(null, { scheduler, touch: (file) => touched.push(file) });
  tracker.acquire()();
  assert.equal(touched.length, 0);
  assert.equal(timers.size, 0);
});

test('touchHeartbeatFile creates the file and moves its mtime', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sandlot-hb-'));
  const file = path.join(dir, 'nested', 'cloudcli.heartbeat');
  touchHeartbeatFile(file);
  const old = new Date(Date.now() - 600_000);
  fs.utimesSync(file, old, old);
  touchHeartbeatFile(file);
  assert.ok(fs.statSync(file).mtimeMs > old.getTime() + 500_000);
});
