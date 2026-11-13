import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { extract, type ReadEntry } from "tar";
import { DownloadError } from "./errors";
import type { Source } from "./source";

const DEFAULT_TIMEOUT_MS = 60_000;

const NETWORK_HINT =
  "Check your internet connection. Behind a proxy, run with NODE_USE_ENV_PROXY=1 and " +
  "HTTPS_PROXY set.";

export function githubTarballUrl(repo: string, ref: string): string {
  return `https://codeload.github.com/${repo}/tar.gz/refs/heads/${ref}`;
}

/**
 * Only `packs.json` and the contents of `skills/` are extracted. Entries other than plain files
 * and folders (symlinks, hard links, devices) are dropped. The first path segment is the
 * wrapper folder GitHub adds to every tarball.
 */
export function shouldExtract(path: string, entry: { type?: string }): boolean {
  if (entry.type !== "File" && entry.type !== "Directory") return false;
  const [, first, ...rest] = path.split("/").filter(Boolean);
  if (first === "packs.json") return entry.type === "File" && rest.length === 0;
  return first === "skills";
}

/** Extracts a (gzipped) tarball stream into `destDir`, stripping the wrapper folder. */
export async function extractTarball(
  stream: NodeJS.ReadableStream,
  destDir: string,
): Promise<void> {
  await pipeline(
    stream,
    extract({
      cwd: destDir,
      strip: 1,
      filter: (path, entry) => shouldExtract(path, entry as ReadEntry),
    }),
  );
}

export interface GithubSourceOptions {
  /** `owner/name` of the repository. */
  repo: string;
  /** Branch to download. */
  ref: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export function createGithubSource(options: GithubSourceOptions): Source {
  const { repo, ref, fetch: fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const url = githubTarballUrl(repo, ref);

  return {
    async download(destDir) {
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok || !response.body) {
          throw new DownloadError(
            `Could not download the Catalog: GitHub answered HTTP ${response.status} for ${url}.`,
          );
        }
        await extractTarball(Readable.fromWeb(response.body as NodeReadableStream), destDir);
      } catch (error) {
        if (error instanceof DownloadError) throw error;
        const reason = error instanceof Error ? error.message : String(error);
        throw new DownloadError(`Could not download the Catalog (${reason}). ${NETWORK_HINT}`, {
          cause: error,
        });
      }
    },
  };
}
