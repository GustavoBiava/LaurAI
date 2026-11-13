import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runs `fn` with a fresh temporary folder, which is removed afterwards even if `fn` throws.
 * Downloads and validation happen here so the user's project is untouched until the very end.
 */
export async function withStaging<T>(fn: (stagingDir: string) => Promise<T>): Promise<T> {
  const stagingDir = await mkdtemp(join(tmpdir(), "laurai-"));
  try {
    return await fn(stagingDir);
  } finally {
    // Best effort: on Windows an antivirus scan can briefly lock files, and the OS cleans tmp.
    await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
