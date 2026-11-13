import { describe, expect, it } from "vitest";
import { LaurAIError } from "../src/core/errors";
import { parseManifest } from "../src/core/manifest";
import { createPlan } from "../src/core/plan";

const catalog = parseManifest({
  schemaVersion: 1,
  packs: [
    { id: "one", name: "One", description: "First", skills: ["a", "b"] },
    { id: "two", name: "Two", description: "Second", skills: ["b", "c"] },
  ],
});

describe("createPlan", () => {
  it("collects the Skills of a Pack", () => {
    expect(createPlan(catalog, ["one"], ["claude-code"]).skills).toEqual(["a", "b"]);
  });

  it("lists a Skill shared by two Packs only once", () => {
    expect(createPlan(catalog, ["one", "two"], ["claude-code"]).skills).toEqual(["a", "b", "c"]);
  });

  it("groups Agents by Skills folder", () => {
    const plan = createPlan(catalog, ["one"], ["claude-code", "codex", "kilo-code"]);
    expect(plan.targets.map((t) => t.skillsDir)).toEqual([".claude/skills", ".agents/skills"]);
  });

  it("rejects an unknown Pack", () => {
    expect(() => createPlan(catalog, ["nope"], ["codex"])).toThrow("Unknown Pack: nope");
  });

  it("requires at least one Pack and one Agent", () => {
    expect(() => createPlan(catalog, [], ["codex"])).toThrow(LaurAIError);
    expect(() => createPlan(catalog, ["one"], [])).toThrow(LaurAIError);
  });
});
