import { z } from "zod";
import { CatalogError, UnsupportedSchemaVersionError } from "./errors";

export const SUPPORTED_SCHEMA_VERSION = 1;

/**
 * Skill and Pack names become folder names on the user's disk, so they are restricted
 * to a safe alphabet: no separators, no dots, nothing that could escape the destination.
 */
const nameSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "must be lowercase letters, digits and hyphens");

const packSchema = z.object({
  id: nameSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  skills: z
    .array(nameSchema)
    .min(1)
    .refine((skills) => new Set(skills).size === skills.length, "must not repeat a Skill"),
});

const manifestSchema = z.object({
  schemaVersion: z.literal(SUPPORTED_SCHEMA_VERSION),
  packs: z
    .array(packSchema)
    .min(1)
    .refine(
      (packs) => new Set(packs.map((pack) => pack.id)).size === packs.length,
      "Pack ids must be unique",
    ),
});

export type Pack = z.infer<typeof packSchema>;
export type Catalog = z.infer<typeof manifestSchema>;

/** Validates the parsed contents of `packs.json`. */
export function parseManifest(raw: unknown): Catalog {
  if (typeof raw !== "object" || raw === null || !("schemaVersion" in raw)) {
    throw new CatalogError("packs.json is invalid: missing schemaVersion.");
  }
  if (raw.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(raw.schemaVersion);
  }
  const result = manifestSchema.safeParse(raw);
  if (!result.success) {
    throw new CatalogError(`packs.json is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
