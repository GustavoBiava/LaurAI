import { groupByTargetDir, type AgentId, type TargetDir } from "./agents";
import { LaurAIError } from "./errors";
import type { Catalog } from "./manifest";

export interface ImportPlan {
  /** Distinct Skills of the chosen Packs, in Catalog order. A Skill in two Packs appears once. */
  skills: string[];
  /** Folders to write to, one per distinct location of the chosen Agents. */
  targets: TargetDir[];
}

export function createPlan(
  catalog: Catalog,
  packIds: readonly string[],
  agentIds: readonly AgentId[],
): ImportPlan {
  if (packIds.length === 0) throw new LaurAIError("Choose at least one Pack.");
  if (agentIds.length === 0) throw new LaurAIError("Choose at least one Agent.");

  const skills = new Set<string>();
  for (const packId of new Set(packIds)) {
    const pack = catalog.packs.find((candidate) => candidate.id === packId);
    if (!pack) throw new LaurAIError(`Unknown Pack: ${packId}`);
    for (const skill of pack.skills) skills.add(skill);
  }

  return { skills: [...skills], targets: groupByTargetDir(agentIds) };
}
