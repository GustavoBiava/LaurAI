import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node24",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  dts: false,
  // Every dependency is a devDependency and is bundled, so `npx laurai`
  // does not have to install anything besides this package.
  noExternal: [/.*/],
});
