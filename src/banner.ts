/** LaurAI identity. Printed when the CLI starts. */
export const BANNER = [
  "░██                                           ░███    ░██████",
  "░██                                          ░██░██     ░██",
  "░██          ░██████   ░██    ░██ ░██░████  ░██  ░██    ░██",
  "░██               ░██  ░██    ░██ ░███     ░█████████   ░██",
  "░██          ░███████  ░██    ░██ ░██      ░██    ░██   ░██",
  "░██         ░██   ░██  ░██   ░███ ░██      ░██    ░██   ░██",
  "░██████████  ░█████░██  ░█████░██ ░██      ░██    ░██ ░██████",
].join("\n");

export function printBanner(): void {
  console.log(`\n${BANNER}\n`);
}
