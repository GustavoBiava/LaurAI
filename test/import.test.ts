import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importSkills, type Conflict, type ConflictDecision } from "../src/core/import";
import { parseManifest } from "../src/core/manifest";
import { createPlan } from "../src/core/plan";
import { withStaging } from "../src/core/staging";

const catalog = parseManifest({
  schemaVersion: 1,
  packs: [{ id: "starter", name: "Starter", description: "Basics", skills: ["alpha", "beta"] }],
});

async function seedStaging(stagingDir: string): Promise<void> {
  for (const skill of ["alpha", "beta"]) {
    await mkdir(join(stagingDir, "skills", skill, "assets"), { recursive: true });
    await writeFile(join(stagingDir, "skills", skill, "SKILL.md"), `new ${skill}`);
    await writeFile(join(stagingDir, "skills", skill, "assets", "note.txt"), "nested");
  }
}

const never = async (): Promise<ConflictDecision> => {
  throw new Error("onConflict should not be called");
};

describe("importSkills", () => {
  it("copies Skills with their nested files into the Agent folder", async () => {
    await withStaging(async (stagingDir) => {
      await withStaging(async (destRoot) => {
        await seedStaging(stagingDir);
        const plan = createPlan(catalog, ["starter"], ["claude-code"]);

        const result = await importSkills({ stagingDir, destRoot, plan, onConflict: never });

        expect(result.imported).toHaveLength(2);
        expect(result.skipped).toEqual([]);
        const base = join(destRoot, ".claude", "skills");
        expect(await readFile(join(base, "alpha", "SKILL.md"), "utf8")).toBe("new alpha");
        expect(await readFile(join(base, "beta", "assets", "note.txt"), "utf8")).toBe("nested");
      });
    });
  });

  it("writes the shared .agents/skills folder once for several Agents", async () => {
    await withStaging(async (stagingDir) => {
      await withStaging(async (destRoot) => {
        await seedStaging(stagingDir);
        const plan = createPlan(catalog, ["starter"], ["codex", "opencode", "kilo-code"]);

        const result = await importSkills({ stagingDir, destRoot, plan, onConflict: never });

        expect(result.imported).toHaveLength(2);
        expect((await readdir(join(destRoot, ".agents", "skills"))).sort()).toEqual([
          "alpha",
          "beta",
        ]);
        await expect(stat(join(destRoot, ".claude"))).rejects.toThrow();
      });
    });
  });

  it("writes to each distinct folder when Agents use different ones", async () => {
    await withStaging(async (stagingDir) => {
      await withStaging(async (destRoot) => {
        await seedStaging(stagingDir);
        const plan = createPlan(catalog, ["starter"], ["claude-code", "codex"]);

        const result = await importSkills({ stagingDir, destRoot, plan, onConflict: never });

        expect(result.imported).toHaveLength(4);
        await stat(join(destRoot, ".claude", "skills", "alpha", "SKILL.md"));
        await stat(join(destRoot, ".agents", "skills", "alpha", "SKILL.md"));
      });
    });
  });

  it("asks before touching an existing Skill and skips it when told to", async () => {
    await withStaging(async (stagingDir) => {
      await withStaging(async (destRoot) => {
        await seedStaging(stagingDir);
        const existing = join(destRoot, ".claude", "skills", "alpha");
        await mkdir(existing, { recursive: true });
        await writeFile(join(existing, "SKILL.md"), "mine");
        const asked: Conflict[] = [];
        const plan = createPlan(catalog, ["starter"], ["claude-code"]);

        const result = await importSkills({
          stagingDir,
          destRoot,
          plan,
          onConflict: async (conflict) => {
            asked.push(conflict);
            return "skip";
          },
        });

        expect(asked.map((c) => c.skill)).toEqual(["alpha"]);
        expect(asked[0]?.path).toBe(existing);
        expect(result.skipped).toEqual([{ skill: "alpha", skillsDir: ".claude/skills" }]);
        expect(result.imported.map((i) => i.skill)).toEqual(["beta"]);
        expect(await readFile(join(existing, "SKILL.md"), "utf8")).toBe("mine");
      });
    });
  });

  it("overwrites an existing Skill when told to", async () => {
    await withStaging(async (stagingDir) => {
      await withStaging(async (destRoot) => {
        await seedStaging(stagingDir);
        const existing = join(destRoot, ".claude", "skills", "alpha");
        await mkdir(existing, { recursive: true });
        await writeFile(join(existing, "SKILL.md"), "mine");
        const plan = createPlan(catalog, ["starter"], ["claude-code"]);

        const result = await importSkills({
          stagingDir,
          destRoot,
          plan,
          onConflict: async () => "overwrite",
        });

        expect(result.skipped).toEqual([]);
        expect(await readFile(join(existing, "SKILL.md"), "utf8")).toBe("new alpha");
      });
    });
  });
});
