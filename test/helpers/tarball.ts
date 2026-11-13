import { gzipSync } from "node:zlib";
import { Header } from "tar";

export interface FixtureEntry {
  path: string;
  type?: "File" | "Directory" | "SymbolicLink";
  content?: string;
  linkpath?: string;
}

const BLOCK = 512;

/** Builds an in-memory .tar.gz, so tests can include entries (symlinks) that are awkward on Windows. */
export function buildTarball(entries: FixtureEntry[]): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const type = entry.type ?? "File";
    const body = Buffer.from(entry.content ?? "");
    const header = new Header({
      path: type === "Directory" ? `${entry.path}/` : entry.path,
      type,
      mode: type === "File" ? 0o644 : 0o755,
      size: type === "File" ? body.length : 0,
      mtime: new Date(0),
      ...(entry.linkpath ? { linkpath: entry.linkpath } : {}),
    });
    header.encode();
    chunks.push(Buffer.from(header.block as Buffer));
    if (type === "File" && body.length > 0) {
      chunks.push(body, Buffer.alloc((BLOCK - (body.length % BLOCK)) % BLOCK));
    }
  }
  chunks.push(Buffer.alloc(BLOCK * 2));
  return gzipSync(Buffer.concat(chunks));
}
