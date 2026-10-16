/**
 * Sets the judge or organizer passcode without it ever appearing on screen,
 * in shell history or in a file — only the scrypt hash is written to .env.
 *
 * Usage:  npm run set-passcode -- judge
 *         npm run set-passcode -- organizer
 *         npm run set-passcode -- judge --print   (print the hash for a hosted env instead of writing .env)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashPasscode } from "../lib/passcode";

const KEYS = { judge: "JUDGE_PASSCODE_HASH", organizer: "ORGANIZER_PASSCODE_HASH" } as const;
const role = process.argv[2] as keyof typeof KEYS | undefined;
const printOnly = process.argv.includes("--print");

if (!role || !(role in KEYS)) {
  console.error("Usage: npm run set-passcode -- judge|organizer [--print]");
  process.exit(1);
}

/** Reads a line from the terminal without echoing it. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error("Run this in an interactive terminal so the passcode can be typed hidden."));
      return;
    }
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolvePromise(value);
          return;
        }
        if (ch === "\u0003") {
          // Ctrl+C
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        value += ch;
        process.stdout.write("•");
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const key = KEYS[role!];
  const first = await askHidden(`New ${role} passcode (min 8 characters): `);
  if (first.length < 8) throw new Error("Passcode must be at least 8 characters.");
  const second = await askHidden("Type it again: ");
  if (first !== second) throw new Error("The two entries don't match. Nothing was changed.");

  const hash = hashPasscode(first);
  if (printOnly) {
    console.log(`\nPaste this into your hosting provider's ${key} variable:\n${hash}`);
    return;
  }

  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) throw new Error(".env not found. Copy .env.example to .env first.");
  const text = readFileSync(envPath, "utf8");
  const line = `${key}=${hash}`;
  const next = new RegExp(`^${key}=.*$`, "m").test(text)
    ? text.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${text.trimEnd()}\n${line}\n`;
  writeFileSync(envPath, next);
  console.log(`\n✓ ${key} updated in .env. The dev server picks it up automatically; restart it if sign-in still uses the old passcode.`);
  console.log(`  Existing ${role}s keep their own saved passcode; new names use the new one.`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
