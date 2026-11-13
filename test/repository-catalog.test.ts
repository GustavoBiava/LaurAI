import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/core/catalog";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The CLI downloads this repository's main branch at runtime (docs/adr/0001), so a broken
 * Catalog reaches every user immediately. These tests keep it valid.
 */
describe("the repository's own Catalog", () => {
  it("is valid and every Pack only lists Skills that exist", async () => {
    await expect(loadCatalog(repoRoot)).resolves.toBeDefined();
  });

  it("has a SKILL.md whose name matches its folder and that has a description", async () => {
    const skills = await readdir(join(repoRoot, "skills"), { withFileTypes: true });
    expect(skills.length).toBeGreaterThan(0);

    for (const entry of skills.filter((candidate) => candidate.isDirectory())) {
      const text = await readFile(join(repoRoot, "skills", entry.name, "SKILL.md"), "utf8");
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
      expect(frontmatter, `${entry.name}: name`).toMatch(
        new RegExp(`^name:\\s*${entry.name}\\s*$`, "m"),
      );
      expect(frontmatter, `${entry.name}: description`).toMatch(/^description:\s*\S+/m);
    }
  });
});
