# Signal-Based Outbound Engine

A working prototype of ARC Automations' signal-based outbound pipeline: real
hiring/funding signal ingestion → waterfall enrichment → Claude-drafted,
human-approved email → send → reply classification → routing → dashboard.

Nothing in this app is a mock. Every integration either calls a real,
verified API, or degrades to a clearly-logged no-op when its key is missing,
so you can run the whole pipeline today and light up paid pieces one at a
time as you sign up for them.

## What's real right now, with zero accounts

- **Signal ingestion** (`src/lib/signals/`) — pulls live from Greenhouse's
  and Lever's public job-board APIs (no auth) and a TechCrunch funding RSS
  feed, scores hiring-relevant titles, and dedupes against what's already
  stored. Verified while building this: seeded companies (Airbnb, Greenhouse,
  Plaid, Lever) return real, currently-open roles, including actual "Sales
  Development Representative" postings.
- **Dashboard, Pipeline, Approvals, Replies pages** — all read live from the
  local SQLite database. No fixtures, no fabricated charts. Zero until the
  pipeline runs.
- **Human approval queue** — every draft is editable and requires an
  explicit approve before anything is "sent" (which defaults to a dry-run
  log, see below).
- **Suppression is actually enforced, not just labeled.** An `unsubscribe`
  reply used to just set `routedTo: "suppressed"` on the `Reply` row with no
  enforcement — nothing stopped that contact from being drafted-to again on
  a later signal. There's now a real `Suppression` table, checked in
  `enrichAndDraftAction` before any draft is created; a blocked attempt
  shows up in the Pipeline view with a clear reason, reusing the existing
  "skipped" status UI. Verified live: suppressing a real contact and
  pointing a fresh signal at them correctly blocks the draft and leaves an
  audit trail, zero drafts created.

## What needs a key from you, in the order to get them

Nothing below is required to explore the app — each one just unlocks the
next stage of the pipeline. Costs are what they were at the time of writing.

| Stage | Provider | Cost to start | Env var |
|---|---|---|---|
| Drafting + reply classification | [Anthropic](https://console.anthropic.com) **or** [Google AI Studio](https://aistudio.google.com/apikey) | Anthropic: pay-as-you-go, a few dollars total. Gemini: genuinely free tier, no card. | `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` |
| Enrichment (waterfall, first rung) | [Hunter.io](https://hunter.io) | Free — 25 searches/month, no card | `HUNTER_API_KEY` |
| Sending | [Instantly](https://instantly.ai) | Paid plan + connected/warmed mailboxes | `INSTANTLY_API_KEY`, `INSTANTLY_CAMPAIGN_ID` |
| Hot-lead alerts | [Slack incoming webhook](https://api.slack.com/apps) | Free | `SLACK_WEBHOOK_URL` |
| CRM sync | [HubSpot private app](https://developers.hubspot.com/docs/api/private-apps) | Free tier, scope `crm.objects.contacts.write` | `HUBSPOT_API_KEY` |
| Meeting booking | [Cal.com webhook](https://cal.com) | Free | `CALCOM_WEBHOOK_SECRET` (only needed to verify signatures) |

Copy `.env.example` to `.env` and fill these in as you get them — see that
file for what each one unlocks and exactly how to obtain it.

### Choosing an AI provider

Drafting and reply classification run behind an `AIProvider` interface
(`src/lib/ai/`) with two implementations: Anthropic (`anthropic.ts`) and
Gemini (`gemini.ts`, plain REST against Google's `generateContent` API — no
extra SDK dependency). Set `AI_PROVIDER=anthropic` or `AI_PROVIDER=gemini`
to pick one explicitly, or leave it unset to auto-detect from whichever key
is present. Gemini's free tier (aistudio.google.com/apikey, no card) is the
lowest-friction way for anyone cloning this repo to try it end-to-end for
$0 — that mattered given this is meant to be run by people other than ARC.

`GEMINI_MODEL` defaults to `gemini-3.6-flash`; if Google has renamed the
current fast model by the time you're reading this, override the env var
rather than editing code.

**Sending is dry-run by default** (`DRY_RUN_SENDING=true`). Approving a draft
logs what would have been sent instead of calling Instantly. Flip it to
`false` only once real mailboxes are connected and warmed — no code change
can shortcut deliverability warmup; that's weeks, not minutes, regardless of
how good the pipeline is.

## Running it

```bash
npm install
npm run seed   # adds 4 real, verified target companies to scan
npm run dev
```

Then, in order:

1. **`/pipeline`** — click "Scan for signals" to pull real postings/funding
   mentions. Click "Enrich & draft" on any signal (needs `HUNTER_API_KEY` +
   `ANTHROPIC_API_KEY`; without them it's a safe no-op that leaves the
   signal retryable).
2. **`/approvals`** — review, edit, approve or reject the AI draft. Approving
   "sends" it (dry-run by default).
3. **`/replies`** — for a sent draft, use "Simulate reply" to type in a
   fake reply and watch it get classified and routed exactly as a real
   inbound webhook would (Slack ping + CRM sync on "interested").
4. **`/`** — the dashboard, reading real counts the whole time.

To add your own target companies instead of the seeded examples, find a
company's Greenhouse board token (their careers page URL is usually
`boards.greenhouse.io/<token>`) or Lever site (`jobs.lever.co/<token>`), then
insert a row via Prisma Studio (`npx prisma studio`) or extend `prisma/seed.ts`.

## Real inbound webhooks (once you're past dry-run)

- `POST /api/webhooks/instantly/reply` — point an Instantly webhook here for
  real inbound replies. The exact payload field names in that route are a
  best-effort based on Instantly's public docs (their interactive API
  reference is JS-rendered and couldn't be scraped exactly) — log one real
  payload and adjust the two field lookups at the top of the handler if
  needed.
- `POST /api/webhooks/calcom` — point a Cal.com `BOOKING_CREATED` webhook
  here to auto-log meetings against the reply that led to them.

## Architecture notes

- **Prisma 7 + SQLite locally**, via the `@prisma/adapter-better-sqlite3`
  driver adapter (Prisma 7 requires an explicit adapter — there's no more
  implicit engine connection). Swapping to Postgres for a client deployment
  is a schema `datasource` change plus swapping the adapter in
  `src/lib/db.ts` for `@prisma/adapter-pg`; the rest of the app is unchanged.
- **SQLite has no native enum type** — status/type fields are `String`,
  validated against the allow-lists in `src/lib/enums.ts`. Promotable to
  real Postgres enums later without touching application code.
- **AI, enrichment, and sending are all behind interfaces**
  (`src/lib/ai/types.ts`, `src/lib/enrichment/types.ts`,
  `src/lib/sending/types.ts`) so another model provider, Apollo/Clay, or a
  different sender can be dropped in without touching the waterfall,
  drafting, or approval logic.
- **Everything mutating goes through Next.js Server Actions**
  (`src/lib/actions.ts`), not client-side fetch calls — this is what Next 16
  recommends for same-app mutations; the two webhook endpoints are the only
  real Route Handlers, because they need a stable public URL for a
  third-party service to POST to.

## Known limitations, on purpose

- The funding-headline → company-name parser is a regex heuristic, not NLP —
  it occasionally captures a noisy sentence fragment as the "company name."
  That's intentionally left for a human to correct in the Pipeline view
  rather than hidden behind a false-precision NLP layer; a paid Crunchbase/
  PitchBook feed would give clean structured data instead.
- The Gemini provider targets Google's stable `v1beta` REST `generateContent`
  endpoint directly rather than the `@google/genai` SDK — while researching
  it, official-looking docs disagreed with each other on the SDK's exact
  config shape, so the long-stable REST contract (`generationConfig` /
  `responseMimeType` / `responseSchema`) was the safer bet. Worth a quick
  real test once you have a `GEMINI_API_KEY` in hand.
- Domain-guessing for funding-round companies (`guessDomain` in
  `fundingRss.ts`) is a first guess, not a lookup — same reasoning.
