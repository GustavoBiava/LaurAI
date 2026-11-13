#!/usr/bin/env node
import { CATALOG_REF, CATALOG_REPO } from "./config";
import { printBanner } from "./banner";
import { createGithubSource } from "./core/github-source";
import { LaurAIError } from "./core/errors";
import { runFlow } from "./flow";

async function main(): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      "LaurAI is interactive and needs a terminal. Run `npx laurai` directly in a terminal.",
    );
    return 1;
  }

  printBanner();

  try {
    return await runFlow({
      source: createGithubSource({ repo: CATALOG_REPO, ref: CATALOG_REF }),
      cwd: process.cwd(),
    });
  } catch (error) {
    if (error instanceof LaurAIError) {
      console.error(`\n${error.message}`);
    } else {
      console.error("\nUnexpected error:", error);
    }
    return 1;
  }
}

process.exitCode = await main();
