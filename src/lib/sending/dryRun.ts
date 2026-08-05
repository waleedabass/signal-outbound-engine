import type { SendInput, SendProvider, SendResult } from "./types";

// Default sender until real mailboxes are connected. Logs what would have
// gone out instead of calling a real API — the whole pipeline (signal to
// "sent") is exercisable end-to-end without spending money or touching a
// real domain's reputation.
export function createDryRunProvider(): SendProvider {
  return {
    name: "dry_run",
    async send(input: SendInput): Promise<SendResult> {
      console.log(
        `[DRY RUN] would send to ${input.firstName} ${input.lastName} <${input.toEmail}>\nSubject: ${input.subject}\n\n${input.body}\n`
      );
      return { provider: "dry_run", externalId: null, mailbox: "dry-run@local" };
    },
  };
}
