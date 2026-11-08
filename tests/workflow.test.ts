import { test } from "node:test";
import assert from "node:assert/strict";

test("outbound approval blocks repeated sends, suppression and empty drafts", async () => {
  const workflow = await import("../src/lib/workflow-validation.ts").catch(() => null);
  assert.ok(workflow, "workflow validation must be available before sending");
  assert.equal(workflow.sendBlockReason({ status: "approved", email: "a@example.com", subject: "Hello", body: "Hi", suppressed: false, sent: true }), "This draft has already been approved or sent.");
  assert.equal(workflow.sendBlockReason({ status: "pending_approval", email: "a@example.com", subject: "Hello", body: "Hi", suppressed: true, sent: false }), "This contact is suppressed. Sending is blocked.");
  assert.equal(workflow.sendBlockReason({ status: "edited", email: "a@example.com", subject: " ", body: "Hi", suppressed: false, sent: false }), "Subject and body are required.");
  assert.equal(workflow.sendBlockReason({ status: "edited", email: "a@example.com", subject: "Hello", body: "Hi", suppressed: false, sent: false }), null);
});

test("sample reply routing prioritizes opt-out over interest", async () => {
  const sample = await import("../src/lib/sample.ts").catch(() => null);
  assert.ok(sample, "sample workflow must be available");
  assert.equal(sample.classifySampleReply("Thanks, but please unsubscribe me"), "unsubscribe");
  assert.equal(sample.classifySampleReply("Interested. Can we book a demo?"), "interested");
  assert.equal(sample.classifySampleReply("We have no budget"), "objection");
  assert.equal(sample.classifySampleReply("   "), "empty");
});

test("explicit stop-email requests override meeting or interest keywords", async () => {
  const { classifySampleReply } = await import("../src/lib/sample.ts");
  for (const reply of [
    "Interested in the demo, but please stop emailing me.",
    "Don't contact me about another meeting.",
    "Please remove my email from your list.",
    "Please take me off your list.",
    "STOP",
  ]) assert.equal(classifySampleReply(reply), "unsubscribe", reply);
  assert.equal(classifySampleReply("Can we book a meeting to discuss stopping manual data entry?"), "interested");
});

test("a later reply cannot automatically clear an existing opt-out", async () => {
  const sample = await import("../src/lib/public-demo.ts");
  assert.equal(typeof sample.routeOutboundReply, "function", "reply routing must retain existing suppression");
  assert.deepEqual(sample.routeOutboundReply("Interested in a demo", true), {route: "unsubscribe", suppressed: true});
  assert.deepEqual(sample.routeOutboundReply("Interested in a demo", false), {route: "interested", suppressed: false});
  assert.deepEqual(sample.routeOutboundReply("Stop emailing me", false), {route: "unsubscribe", suppressed: true});
});
