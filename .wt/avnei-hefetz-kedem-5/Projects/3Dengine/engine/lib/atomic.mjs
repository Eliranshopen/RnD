// Atomic file writes and a small file mutex. A job's three files (job.json, manifest.json, ledger.json)
// are written through writeFileAtomic: temp file in the same folder, then rename over the target, retried
// on Windows, where any reader holding the file open (the bridge, a poller, a virus scanner) makes the
// rename fail until it lets go. The retry is bounded by time (retryMs, backoff 5 → 50 ms), not by count.
import fs from 'node:fs';
import path from 'node:path';
import { sleepSync, pidAlive } from './proc.mjs';

// UNKNOWN is what Node reports for a Windows error it has no name for; the one seen here (2026-11-17) is
// "the file has a user-mapped section open": another process (a scanner, a `git status`) has the file
// mapped at that instant. It passes like the others.
export const RETRY = new Set(['EPERM', 'EBUSY', 'EACCES', 'UNKNOWN']);
export const RENAME_RETRY_MS = 3000;

// A file error another process causes for a moment (Windows: a reader holds the file; a lock is busy).
export const isTransient = (e) => Boolean(e) && (RETRY.has(e.code) || / lock busy$/.test(String(e.message)));

export function writeFileAtomic(file, data, { retryMs = RENAME_RETRY_MS, clock = () => Date.now() } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  fs.writeFileSync(tmp, data);
  const until = clock() + retryMs;
  for (let wait = 5; ; wait = Math.min(50, wait * 2)) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      if (!RETRY.has(e.code) || clock() >= until) {
        fs.rmSync(tmp, { force: true });
        throw e;
      }
      sleepSync(wait);
    }
  }
}

export function writeJsonAtomic(file, data, opts) {
  writeFileAtomic(file, JSON.stringify(data, null, 2) + '\n', opts);
  return data;
}

// Remove a stale lock file only if it is still the one judged stale: it is moved aside first, and put back
// when what was moved holds other content (another process took the lock in between).
export function takeOverStale(lock, seen) {
  const aside = `${lock}.${process.pid}.${Math.random().toString(16).slice(2)}.stale`;
  try {
    fs.renameSync(lock, aside);
  } catch {
    return; // gone meanwhile
  }
  let now = null;
  try {
    now = fs.readFileSync(aside, 'utf8');
  } catch { /* unreadable: treat as changed */ }
  if (now === seen) fs.rmSync(aside, { force: true });
  else {
    try {
      fs.renameSync(aside, lock);
    } catch {
      fs.rmSync(aside, { force: true });
    }
  }
}

export const EMPTY_LOCK_STALE_MS = 1000;

// Is the lock file whose text is `text` and whose age is `ageMs` stale? (contract 0.3 §10.4)
//   - it holds the pid of a dead process (a killed holder);
//   - it is empty or unreadable for more than emptyStaleMs (a holder killed in the act of creating it);
//   - it is older than staleMs, whatever it holds.
export function lockIsStale(text, ageMs, { staleMs = 10000, emptyStaleMs = EMPTY_LOCK_STALE_MS, alive = pidAlive, self = process.pid } = {}) {
  const holder = Number(String(text).trim());
  const empty = String(text).trim() === '' || !Number.isInteger(holder) || holder <= 0;
  if (empty) return ageMs > emptyStaleMs;
  if (holder !== self && !alive(holder)) return true;
  return ageMs > staleMs;
}

// Put the lock in place WITH its content, in one atomic step: the pid is written to a temp file, and a
// hard link to it is created under the lock's name. Creating the link fails when the lock exists, so the
// lock is born holding its pid and is never seen empty. Where hard links are not possible the lock is
// created exclusively and written at once (the empty moment is then covered by emptyStaleMs).
// Returns true when the lock is now ours, false when it exists.
export function createLockWithContent(lock, content, { link = fs.linkSync } = {}) {
  const tmp = `${lock}.${process.pid}.${Math.random().toString(16).slice(2)}.new`;
  fs.writeFileSync(tmp, content);
  try {
    link(tmp, lock);
    return true;
  } catch (e) {
    if (e.code === 'EEXIST' || RETRY.has(e.code)) return false;
    // No hard links here: exclusive create, then the content.
    let fd;
    try {
      fd = fs.openSync(lock, 'wx');
    } catch (e2) {
      if (e2.code === 'EEXIST' || RETRY.has(e2.code)) return false;
      throw e2;
    }
    try {
      fs.writeSync(fd, content);
    } finally {
      fs.closeSync(fd);
    }
    return true;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// Remove our own lock; on Windows a reader may hold it open for a moment.
function removeLock(lock, { retryMs = 1000 } = {}) {
  const until = Date.now() + retryMs;
  for (;;) {
    try {
      fs.rmSync(lock, { force: true });
      return;
    } catch (e) {
      if (!RETRY.has(e.code) || Date.now() >= until) throw e;
      sleepSync(5);
    }
  }
}

// Run fn() holding the lock file `lock`. The lock is created together with its content (the holder's pid),
// so it is never empty. A stale lock (lockIsStale) is taken over. Throws `<label>: lock busy` after waitMs.
export function withFileLock(lock, fn, { waitMs = 2000, staleMs = 10000, emptyStaleMs = EMPTY_LOCK_STALE_MS, label = lock, alive = pidAlive, link } = {}) {
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const until = Date.now() + waitMs;
  while (!createLockWithContent(lock, String(process.pid), link ? { link } : undefined)) {
    try {
      const text = fs.readFileSync(lock, 'utf8');
      const ageMs = Date.now() - fs.statSync(lock).mtimeMs;
      if (lockIsStale(text, ageMs, { staleMs, emptyStaleMs, alive })) takeOverStale(lock, text);
    } catch { /* gone meanwhile, or not a file */ }
    if (Date.now() > until) throw new Error(`${label}: lock busy`);
    sleepSync(5);
  }
  try {
    return fn();
  } finally {
    removeLock(lock);
  }
}
