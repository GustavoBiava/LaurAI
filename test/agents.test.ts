import { describe, expect, it } from "vitest";
import { groupByTargetDir } from "../src/core/agents";

describe("groupByTargetDir", () => {
  it("maps Claude Code to .claude/skills", () => {
    const targets = groupByTargetDir(["claude-code"]);
    expect(targets.map((t) => t.skillsDir)).toEqual([".claude/skills"]);
  });

  it("shares .agents/skills between Codex, Opencode and Kilo Code", () => {
    const targets = groupByTargetDir(["codex", "opencode", "kilo-code"]);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.skillsDir).toBe(".agents/skills");
    expect(targets[0]?.agents.map((a) => a.id)).toEqual(["codex", "opencode", "kilo-code"]);
  });

  it("returns one folder per distinct location, in the order chosen", () => {
    const targets = groupByTargetDir(["opencode", "claude-code", "codex"]);
    expect(targets.map((t) => t.skillsDir)).toEqual([".agents/skills", ".claude/skills"]);
  });

  it("ignores duplicated Agents", () => {
    const targets = groupByTargetDir(["codex", "codex"]);
    expect(targets[0]?.agents).toHaveLength(1);
  });

  it("returns nothing when no Agent is chosen", () => {
    expect(groupByTargetDir([])).toEqual([]);
  });
});
