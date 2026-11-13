import { cp, lstat, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { skillSource } from "./catalog";
import type { ImportPlan } from "./plan";

export type ConflictDecision = "overwrite" | "skip";

export interface Conflict {
  skill: string;
  /** Skills folder relative to the destination, e.g. `.claude/skills`. */
  skillsDir: string;
  /** Absolute path of the Skill folder that already exists. */
  path: string;
}

export interface ImportedSkill {
  skill: string;
  skillsDir: string;
}

export interface ImportResult {
  imported: ImportedSkill[];
  skipped: ImportedSkill[];
}

export interface ImportOptions {
  /** Downloaded and validated copy of the repository. */
  stagingDir: string;
  /** The user's current directory. */
  destRoot: string;
  plan: ImportPlan;
  /** Called when a Skill folder already exists; never overwritten without an answer. */
  onConflict: (conflict: Conflict) => Promise<ConflictDecision>;
}

async function exists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    () => false,
  );
}

/**
 * Copies every planned Skill into every target folder under `destRoot`.
 * Nothing here is transactional: if a copy fails midway, Skills copied so far stay on disk.
 */
export async function importSkills(options: ImportOptions): Promise<ImportResult> {
  const { stagingDir, destRoot, plan, onConflict } = options;
  const result: ImportResult = { imported: [], skipped: [] };

  for (const target of plan.targets) {
    for (const skill of plan.skills) {
      const destination = join(destRoot, ...target.skillsDir.split("/"), skill);
      const item = { skill, skillsDir: target.skillsDir };

      if (await exists(destination)) {
        const decision = await onConflict({ ...item, path: destination });
        if (decision === "skip") {
          result.skipped.push(item);
          continue;
        }
      }

      await mkdir(dirname(destination), { recursive: true });
      await cp(skillSource(stagingDir, skill), destination, { recursive: true, force: true });
      result.imported.push(item);
    }
  }

  return result;
}
