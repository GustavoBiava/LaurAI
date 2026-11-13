export type AgentId = "claude-code" | "codex" | "opencode" | "kilo-code";

export interface Agent {
  id: AgentId;
  label: string;
  /** Project-level Skills folder, relative to the current directory (POSIX separators). */
  skillsDir: string;
}

/**
 * Codex, Opencode and Kilo Code all read `.agents/skills`, so they share one folder.
 * Claude Code only reads `.claude/skills`.
 */
export const AGENTS: readonly Agent[] = [
  { id: "claude-code", label: "Claude Code", skillsDir: ".claude/skills" },
  { id: "codex", label: "Codex", skillsDir: ".agents/skills" },
  { id: "opencode", label: "Opencode", skillsDir: ".agents/skills" },
  { id: "kilo-code", label: "Kilo Code", skillsDir: ".agents/skills" },
];

export interface TargetDir {
  skillsDir: string;
  agents: Agent[];
}

/** Groups the chosen Agents by Skills folder so a shared folder is only written once. */
export function groupByTargetDir(agentIds: readonly AgentId[]): TargetDir[] {
  const targets = new Map<string, TargetDir>();
  for (const id of new Set(agentIds)) {
    const agent = AGENTS.find((candidate) => candidate.id === id);
    if (!agent) throw new Error(`Unknown agent: ${id}`);
    const target = targets.get(agent.skillsDir) ?? { skillsDir: agent.skillsDir, agents: [] };
    target.agents.push(agent);
    targets.set(agent.skillsDir, target);
  }
  return [...targets.values()];
}
