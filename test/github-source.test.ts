import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DownloadError } from "../src/core/errors";
import { createGithubSource, githubTarballUrl, shouldExtract } from "../src/core/github-source";
import { buildTarball, type FixtureEntry } from "./helpers/tarball";

const repoTarball: FixtureEntry[] = [
  { path: "LaurAI-main", type: "Directory" },
  { path: "LaurAI-main/packs.json", content: '{"schemaVersion":1}' },
  { path: "LaurAI-main/README.md", content: "ignored" },
  { path: "LaurAI-main/src", type: "Directory" },
  { path: "LaurAI-main/src/cli.ts", content: "ignored" },
  { path: "LaurAI-main/skills", type: "Directory" },
  { path: "LaurAI-main/skills/demo", type: "Directory" },
  { path: "LaurAI-main/skills/demo/SKILL.md", content: "# demo" },
  { path: "LaurAI-main/skills/demo/assets/note.txt", content: "nested" },
  { path: "LaurAI-main/skills/link", type: "SymbolicLink", linkpath: "../../outside" },
  { path: "LaurAI-main/packs.json.d/other.txt", content: "ignored" },
];

function respondWith(body: Buffer, init?: ResponseInit): typeof fetch {
  return async () => new Response(new Uint8Array(body), init);
}

let dest: string;
beforeEach(async () => {
  dest = await mkdtemp(join(tmpdir(), "laurai-test-"));
});
afterEach(async () => {
  await rm(dest, { recursive: true, force: true });
});

describe("shouldExtract", () => {
  it("keeps packs.json and files under skills/", () => {
    expect(shouldExtract("repo-main/packs.json", { type: "File" })).toBe(true);
    expect(shouldExtract("repo-main/skills/a/SKILL.md", { type: "File" })).toBe(true);
    expect(shouldExtract("repo-main/skills/a", { type: "Directory" })).toBe(true);
  });

  it("drops everything else", () => {
    expect(shouldExtract("repo-main/README.md", { type: "File" })).toBe(false);
    expect(shouldExtract("repo-main/src/skills/x", { type: "File" })).toBe(false);
    expect(shouldExtract("repo-main/packs.json/inner", { type: "File" })).toBe(false);
    expect(shouldExtract("repo-main", { type: "Directory" })).toBe(false);
  });

  it("drops symlinks and other special entries", () => {
    expect(shouldExtract("repo-main/skills/link", { type: "SymbolicLink" })).toBe(false);
    expect(shouldExtract("repo-main/skills/hard", { type: "Link" })).toBe(false);
  });
});

describe("createGithubSource", () => {
  it("builds the codeload URL for a branch", () => {
    expect(githubTarballUrl("owner/repo", "main")).toBe(
      "https://codeload.github.com/owner/repo/tar.gz/refs/heads/main",
    );
  });

  it("extracts packs.json and skills/ without the wrapper folder", async () => {
    const source = createGithubSource({
      repo: "owner/repo",
      ref: "main",
      fetch: respondWith(buildTarball(repoTarball)),
    });

    await source.download(dest);

    expect((await readdir(dest)).sort()).toEqual(["packs.json", "skills"]);
    expect(await readFile(join(dest, "packs.json"), "utf8")).toBe('{"schemaVersion":1}');
    expect(await readFile(join(dest, "skills/demo/SKILL.md"), "utf8")).toBe("# demo");
    expect(await readFile(join(dest, "skills/demo/assets/note.txt"), "utf8")).toBe("nested");
    await expect(stat(join(dest, "skills/link"))).rejects.toThrow();
  });

  it("requests the tarball of the configured branch", async () => {
    const urls: string[] = [];
    const source = createGithubSource({
      repo: "owner/repo",
      ref: "develop",
      fetch: async (input) => {
        urls.push(String(input));
        return new Response(new Uint8Array(buildTarball(repoTarball)));
      },
    });
    await source.download(dest);
    expect(urls).toEqual(["https://codeload.github.com/owner/repo/tar.gz/refs/heads/develop"]);
  });

  it("fails with a clear error on an HTTP error", async () => {
    const source = createGithubSource({
      repo: "owner/repo",
      ref: "main",
      fetch: respondWith(Buffer.from("nope"), { status: 404 }),
    });
    await expect(source.download(dest)).rejects.toThrow(/HTTP 404/);
  });

  it("fails with a network hint when the request cannot be made", async () => {
    const source = createGithubSource({
      repo: "owner/repo",
      ref: "main",
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    const error = await source.download(dest).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DownloadError);
    expect((error as Error).message).toContain("NODE_USE_ENV_PROXY=1");
  });

  it("fails with a DownloadError when the body is not a tarball", async () => {
    const source = createGithubSource({
      repo: "owner/repo",
      ref: "main",
      fetch: respondWith(Buffer.from("this is not a gzip stream")),
    });
    await expect(source.download(dest)).rejects.toBeInstanceOf(DownloadError);
  });
});
