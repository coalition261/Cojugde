/** Runs once when the Next.js server starts. Starts the built-in alert scheduler. */
export async function register() {
  // Must be an `if` around the import (not an early return) so the Edge bundle drops it.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
