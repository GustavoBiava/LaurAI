/** An error whose message is safe and useful to show to the user as-is. */
export class LaurAIError extends Error {
  override name = "LaurAIError";
}

/** The Catalog (`packs.json`) is missing, malformed or points to missing Skills. */
export class CatalogError extends LaurAIError {
  override name = "CatalogError";
}

/** The Catalog uses a `schemaVersion` this CLI does not understand. */
export class UnsupportedSchemaVersionError extends CatalogError {
  override name = "UnsupportedSchemaVersionError";

  constructor(found: unknown) {
    super(
      `The Catalog uses schema version ${JSON.stringify(found)}, which this version of LaurAI ` +
        "does not understand. Update with: npx laurai@latest",
    );
  }
}

/** The Catalog could not be downloaded. */
export class DownloadError extends LaurAIError {
  override name = "DownloadError";
}
