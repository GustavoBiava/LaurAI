import { describe, expect, it } from "vitest";
import { CatalogError, UnsupportedSchemaVersionError } from "../src/core/errors";
import { parseManifest } from "../src/core/manifest";

const valid = {
  schemaVersion: 1,
  packs: [{ id: "starter", name: "Starter", description: "Basics", skills: ["a", "b-2"] }],
};

describe("parseManifest", () => {
  it("accepts a valid manifest", () => {
    expect(parseManifest(valid).packs[0]?.skills).toEqual(["a", "b-2"]);
  });

  it("ignores unknown fields so newer catalogs keep working", () => {
    const withExtra = { ...valid, futureField: true };
    expect(() => parseManifest(withExtra)).not.toThrow();
  });

  it.each([null, "text", 42, {}, { packs: [] }])("rejects %j without a schemaVersion", (raw) => {
    expect(() => parseManifest(raw)).toThrow(CatalogError);
  });

  it("asks the user to update the CLI when the schema version is unsupported", () => {
    const attempt = () => parseManifest({ ...valid, schemaVersion: 2 });
    expect(attempt).toThrow(UnsupportedSchemaVersionError);
    expect(attempt).toThrow("npx laurai@latest");
  });

  it.each(["../evil", "a/b", "a\b", ".hidden", "UPPER", "", "a b", "/abs"])(
    "rejects the unsafe Skill name %j",
    (name) => {
      const raw = { ...valid, packs: [{ ...valid.packs[0], skills: [name] }] };
      expect(() => parseManifest(raw)).toThrow(CatalogError);
    },
  );

  it("rejects an empty Pack", () => {
    const raw = { ...valid, packs: [{ ...valid.packs[0], skills: [] }] };
    expect(() => parseManifest(raw)).toThrow(CatalogError);
  });

  it("rejects an empty Catalog", () => {
    expect(() => parseManifest({ schemaVersion: 1, packs: [] })).toThrow(CatalogError);
  });

  it("rejects duplicated Pack ids", () => {
    const raw = { ...valid, packs: [valid.packs[0], valid.packs[0]] };
    expect(() => parseManifest(raw)).toThrow("Pack ids must be unique");
  });

  it("rejects a Skill repeated inside a Pack", () => {
    const raw = { ...valid, packs: [{ ...valid.packs[0], skills: ["a", "a"] }] };
    expect(() => parseManifest(raw)).toThrow(CatalogError);
  });
});
