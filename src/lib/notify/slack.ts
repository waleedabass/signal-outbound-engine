// Slack Incoming Webhooks — create one free at api.slack.com/apps → your app
// → Incoming Webhooks. No bot token, scopes, or paid tier required.
export async function postToSlack(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.log(`[SLACK disabled — set SLACK_WEBHOOK_URL] ${text}`);
    return;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }
}
