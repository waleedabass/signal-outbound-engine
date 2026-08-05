import type { SendProvider } from "./types";
import { createInstantlyProvider } from "./instantly";
import { createDryRunProvider } from "./dryRun";

export function getSendProvider(): SendProvider {
  const dryRun = process.env.DRY_RUN_SENDING !== "false"; // dry-run by default, opt out explicitly
  if (!dryRun && process.env.INSTANTLY_API_KEY && process.env.INSTANTLY_CAMPAIGN_ID) {
    return createInstantlyProvider(process.env.INSTANTLY_API_KEY, process.env.INSTANTLY_CAMPAIGN_ID);
  }
  return createDryRunProvider();
}

export type { SendInput, SendResult, SendProvider } from "./types";
