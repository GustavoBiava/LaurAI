import { rmSync } from "node:fs";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  note,
  outro,
  select,
  spinner,
} from "@clack/prompts";
import { AGENTS, type AgentId } from "./core/agents";
import { loadCatalog } from "./core/catalog";
import { importSkills, type ConflictDecision } from "./core/import";
import { createPlan } from "./core/plan";
import type { Source } from "./core/source";
import { withStaging } from "./core/staging";

/** Exit code conventionally used when a process is interrupted with Ctrl+C. */
export const EXIT_CANCELLED = 130;

class Cancelled extends Error {}

function unlessCancelled<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) throw new Cancelled();
  return value as Exclude<T, symbol>;
}

export interface FlowOptions {
  source: Source;
  /** The folder Skills are imported into. */
  cwd: string;
}

/** Runs the interactive import. Returns the process exit code. */
export async function runFlow({ source, cwd }: FlowOptions): Promise<number> {
  intro("Import Skills into this folder");
  let writing = false;

  try {
    await withStaging(async (stagingDir) => {
      // Ctrl+C while the Catalog downloads: clean up the staging folder and leave.
      const onInterrupt = (): void => {
        rmSync(stagingDir, { recursive: true, force: true });
        cancel("Cancelled. Nothing was written.");
        process.exit(EXIT_CANCELLED);
      };
      process.once("SIGINT", onInterrupt);

      try {
        const loading = spinner();
        loading.start("Downloading the Catalog");
        let catalog;
        try {
          await source.download(stagingDir);
          catalog = await loadCatalog(stagingDir);
        } catch (error) {
          loading.error("Could not load the Catalog");
          throw error;
        }
        loading.stop("Catalog loaded");

        const agentIds = unlessCancelled(
          await multiselect<AgentId>({
            message: "Which agents do you use?",
            options: AGENTS.map((agent) => ({
              value: agent.id,
              label: agent.label,
              hint: agent.skillsDir,
            })),
          }),
        );

        const packIds = unlessCancelled(
          await multiselect<string>({
            message: "Which packs do you want to import?",
            options: catalog.packs.map((pack) => ({
              value: pack.id,
              label: pack.name,
              hint: `${pack.description} (${pack.skills.length} skills)`,
            })),
          }),
        );

        const plan = createPlan(catalog, packIds, agentIds);

        note(
          [
            ...plan.targets.map(
              (target) =>
                `${target.skillsDir}/  (${target.agents.map((agent) => agent.label).join(", ")})`,
            ),
            "",
            ...plan.skills.map((skill) => `- ${skill}`),
          ].join("\n"),
          `${plan.skills.length} skill(s) will be copied to ${cwd}`,
        );

        const confirmed = unlessCancelled(await confirm({ message: "Import now?" }));
        if (!confirmed) throw new Cancelled();

        writing = true;
        const result = await importSkills({
          stagingDir,
          destRoot: cwd,
          plan,
          onConflict: async ({ skill, skillsDir }): Promise<ConflictDecision> =>
            unlessCancelled(
              await select<ConflictDecision>({
                message: `${skillsDir}/${skill} already exists. What now?`,
                options: [
                  { value: "skip", label: "Skip", hint: "keep my version" },
                  { value: "overwrite", label: "Overwrite", hint: "copy over the existing files" },
                ],
              }),
            ),
        });

        for (const item of result.skipped) log.warn(`Skipped ${item.skillsDir}/${item.skill}`);
        outro(`Imported ${result.imported.length}, skipped ${result.skipped.length}.`);
      } finally {
        process.removeListener("SIGINT", onInterrupt);
      }
    });
    return 0;
  } catch (error) {
    if (error instanceof Cancelled) {
      cancel(
        writing
          ? "Cancelled. Skills copied before this point were kept."
          : "Cancelled. Nothing was written.",
      );
      return EXIT_CANCELLED;
    }
    throw error;
  }
}
