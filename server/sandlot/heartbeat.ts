/**
 * CLOUDCLI_HEARTBEAT_FILE: the workspace's idle watchdog reads this file's
 * mtime. While at least one authenticated WebSocket client is connected the
 * file is touched at once and then every HEARTBEAT_INTERVAL_MS (well inside
 * the contract's 60 s); with no client it is left alone, so it ages.
 */
import fs from 'node:fs';
import path from 'node:path';

export const HEARTBEAT_INTERVAL_MS = 30_000;

type Scheduler = {
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
};

export type HeartbeatFileTracker = {
  /** Call when an authenticated socket opens; returns a release function for its close. */
  acquire(): () => void;
  /** Number of sockets currently holding the heartbeat. */
  readonly activeClients: number;
  stop(): void;
};

/** Updates the file's mtime, creating it (and its directory) if needed. */
export function touchHeartbeatFile(filePath: string): void {
  const now = new Date();
  try {
    fs.utimesSync(filePath, now, now);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    fs.closeSync(fs.openSync(filePath, 'a', 0o600));
    fs.utimesSync(filePath, now, now);
  }
}

export function createHeartbeatFileTracker(
  filePath: string | null,
  options: { intervalMs?: number; scheduler?: Scheduler; touch?: (filePath: string) => void } = {},
): HeartbeatFileTracker {
  const intervalMs = options.intervalMs ?? HEARTBEAT_INTERVAL_MS;
  const scheduler = options.scheduler ?? { setInterval, clearInterval };
  const touch = options.touch ?? touchHeartbeatFile;
  let activeClients = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const beat = () => {
    if (!filePath) return;
    try {
      touch(filePath);
    } catch (error) {
      console.warn('[WARN] Could not touch CLOUDCLI_HEARTBEAT_FILE:', (error as Error)?.message ?? error);
    }
  };

  const stopTimer = () => {
    if (timer) {
      scheduler.clearInterval(timer);
      timer = null;
    }
  };

  return {
    acquire() {
      activeClients += 1;
      if (activeClients === 1 && filePath) {
        beat();
        timer = scheduler.setInterval(beat, intervalMs);
        (timer as { unref?: () => void }).unref?.();
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        activeClients = Math.max(0, activeClients - 1);
        if (activeClients === 0) {
          stopTimer();
        }
      };
    },
    get activeClients() {
      return activeClients;
    },
    stop: stopTimer,
  };
}
