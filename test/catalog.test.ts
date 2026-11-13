import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/core/catalog";
import { CatalogError } from "../src/core/errors";
import { withStaging } from "../src/core/staging";

async function writeSkill(root: string, name: string, withSkillFile = true): Promise<void> {
  await mkdir(join(root, "skills", name), { recursive: true });
  if (withSkillFile) await writeFile(join(root, "skills", name, "SKILL.md"), `# ${name}`);
}

const manifest = (skills: string[]) =>
  JSON.stringify({
    schemaVersion: 1,
    packs: [{ id: "starter", name: "Starter", description: "Basics", skills }],
  });

describe("withStaging", () => {
  it("removes the folder after the callback", async () => {
    let seen = "";
    await withStaging(async (dir) => {
      seen = dir;
      await writeFile(join(dir, "file.txt"), "x");
    });
    await expect(stat(seen)).rejects.toThrow();
  });

  it("removes the folder when the callback throws", async () => {
    let seen = "";
    await expect(
      withStaging(async (dir) => {
        seen = dir;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(stat(seen)).rejects.toThrow();
  });
});

describe("loadCatalog", () => {
  it("loads a consistent Catalog", async () => {
    await withStaging(async (root) => {
      await writeSkill(root, "a");
      await writeSkill(root, "b");
      await writeFile(join(root, "packs.json"), manifest(["a", "b"]));

      const catalog = await loadCatalog(root);
      expect(catalog.packs[0]?.skills).toEqual(["a", "b"]);
    });
  });

  it("fails when packs.json is missing", async () => {
    await withStaging(async (root) => {
      await expect(loadCatalog(root)).rejects.toThrow(/file not found/);
    });
  });

  it("fails when packs.json is not JSON", async () => {
    await withStaging(async (root) => {
      await writeFile(join(root, "packs.json"), "{ nope");
      await expect(loadCatalog(root)).rejects.toThrow(/not valid JSON/);
    });
  });

  it("reports every Skill that a Pack lists but the repository does not have", async () => {
    await withStaging(async (root) => {
      await writeSkill(root, "a");
      await writeSkill(root, "no-skill-file", false);
      await writeFile(join(root, "packs.json"), manifest(["a", "ghost", "no-skill-file"]));

      const error = await loadCatalog(root).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CatalogError);
      expect((error as Error).message).toContain('"ghost"');
      expect((error as Error).message).toContain('"no-skill-file"');
      expect((error as Error).message).not.toContain('"a"');
    });
  });
});
