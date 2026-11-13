import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "./errors";
import { parseManifest, type Catalog } from "./manifest";

export const MANIFEST_FILE = "packs.json";
export const SKILLS_DIR = "skills";

/** Folder of a Skill inside a downloaded copy of the repository. */
export function skillSource(root: string, skill: string): string {
  return join(root, SKILLS_DIR, skill);
}

async function isFile(path: string): Promise<boolean> {
  return lstat(path)
    .then((stats) => stats.isFile())
    .catch(() => false);
}

async function isDirectory(path: string): Promise<boolean> {
  return lstat(path)
    .then((stats) => stats.isDirectory())
    .catch(() => false);
}

/**
 * Reads and validates the Catalog of a downloaded copy of the repository, and checks that
 * every Skill a Pack refers to exists, so a broken Catalog is caught before anything is copied.
 */
export async function loadCatalog(root: string): Promise<Catalog> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(root, MANIFEST_FILE), "utf8"));
  } catch (error) {
    const reason =
      error instanceof Error && "code" in error && error.code === "ENOENT"
        ? "file not found"
        : "not valid JSON";
    throw new CatalogError(`Could not read ${MANIFEST_FILE} (${reason}).`, { cause: error });
  }

  const catalog = parseManifest(raw);

  const problems: string[] = [];
  for (const pack of catalog.packs) {
    for (const skill of pack.skills) {
      const folder = skillSource(root, skill);
      if (!(await isDirectory(folder)) || !(await isFile(join(folder, "SKILL.md")))) {
        problems.push(
          `Pack "${pack.id}" lists Skill "${skill}", but ${SKILLS_DIR}/${skill}/SKILL.md is missing.`,
        );
      }
    }
  }
  if (problems.length > 0) {
    throw new CatalogError(`The Catalog is inconsistent:\n- ${problems.join("\n- ")}`);
  }

  return catalog;
}
