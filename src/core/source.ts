/** Anything that can place a copy of the repository contents into a folder. */
export interface Source {
  /** Downloads `packs.json` and `skills/` into `destDir` (the repository root, without wrapper folder). */
  download(destDir: string): Promise<void>;
}
