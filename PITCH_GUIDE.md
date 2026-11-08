# Signal-Based Outbound Engine — Pitch Guide & Productionization Kit

Repo: https://github.com/waleedabass/signal-outbound-engine

---

## 1. Production-Conversion Prompt

Copy this into a fresh Claude Code session (or hand it to a dev) once you have a signed client and their details filled in from Section 2. It assumes the client's repo is a clone of `signal-outbound-engine`.

```
I'm taking the signal-outbound-engine prototype to production for a real client.
Read AGENTS.md, CLAUDE.md, and README.md first, then do the following:

CLIENT CONTEXT
- Client: [CLIENT_NAME], selling [CLIENT_PRODUCT/SERVICE] to [ICP_DESCRIPTION]
- Target signal sources: [WHICH ATSs/job boards the client's prospects use —
  Greenhouse/Lever tokens for their actual target accounts, or a different
  signal type entirely: funding rounds, tech-stack changes, etc.]
- Sending domain / mailbox: [CLIENT_SENDING_DOMAIN], warmed up via [PROVIDER]
- CRM: [CLIENT_CRM — HubSpot/Salesforce/Pipedrive/other]
- Meeting booking: [CLIENT_CALENDAR — Cal.com/Calendly/other]

DATA LAYER
- Replace SQLite + @prisma/adapter-better-sqlite3 with Postgres
  (@prisma/adapter-pg or Prisma Postgres) — [CONNECTION_STRING].
- Migrate the existing schema as-is; no structural changes needed unless
  the client's ICP requires different signal types than Greenhouse/Lever
  job postings.

REAL INTEGRATIONS TO WIRE (replace log-only defaults)
- Hunter.io waterfall enrichment: already real — just needs the client's
  own paid Hunter.io key with sufficient credit volume for their target
  list size.
- Sending: replace/confirm Instantly.ai account is the client's own,
  connected to their warmed sending domain (or swap the provider in
  src/lib/sending/ if the client uses a different platform — Smartlead,
  Apollo, etc. — behind the same SendingProvider interface).
- CRM sync: point HubSpot integration at the client's real portal (private
  app token with contacts write scope), or implement Salesforce/Pipedrive
  behind the existing CrmProvider interface if that's their CRM.
- Cal.com booking webhook: point at the client's real Cal.com (or swap
  providers) event type, set CALCOM_WEBHOOK_SECRET for real signature
  verification.
- Reply classification/inbound: wire a real inbound-email webhook (the
  provider's reply-tracking webhook, e.g. Instantly's) instead of the
  manual simulateReplyAction demo path — map its payload into
  processInboundReply.

COMPLIANCE
- Add a real unsubscribe/suppression sync so opt-outs also suppress in
  [CLIENT_ESP/CRM], not just this app's local Suppression table.
- Confirm outbound copy and cadence meet CAN-SPAM/GDPR/CASL requirements
  for [CLIENT_TARGET_REGIONS] — add a physical mailing address and
  one-click unsubscribe link to the email templates if not already present
  in the provider's sending layer.

DEPLOYMENT
- Deploy to [VERCEL/CLIENT_INFRA], environment variables set from Section 2
  below, custom domain [CLIENT_APP_DOMAIN].
- Add authentication (the prototype has none — every page is open) —
  [SSO/PASSWORD/CLIENT_AUTH_PREFERENCE] gating access to the pipeline,
  approvals, and replies pages.

BRANDING
- Replace the Pixel AI Solutions palette/logo in src/app/globals.css and
  src/app/layout.tsx with [CLIENT_NAME]'s brand colors and logo.

Test the full pipeline live against real target accounts before handoff:
scan → enrich → draft → approve → send → reply → CRM sync → booking.
```

---

## 2. Client Details Needed

**Brand & identity**
- Company name, logo, brand colors (hex), tone-of-voice guidelines for outbound copy

**ICP & targeting**
- Who they sell to (industry, company size, title/persona)
- Which signal predicts buying intent for them — hiring for a specific role, funding round, tech-stack change, expansion announcement, etc.
- A list of target-account ATS board tokens if using Greenhouse/Lever signal scanning (e.g. company.greenhouse.io/**token**), or the alternative signal source to build instead

**Sending infrastructure**
- Sending domain(s), already warmed up (or budget/timeline to warm one)
- Instantly.ai account (or their existing outbound platform) — API key
- From-name/from-address conventions, signature, unsubscribe/compliance footer text
- Daily/weekly sending volume limits they want enforced

**Enrichment**
- Hunter.io account (or preferred alternative — Apollo, Clearbit, ZoomInfo) with enough credit for expected monthly volume

**CRM**
- Which CRM (HubSpot/Salesforce/Pipedrive/other), a private app token or OAuth app credentials, and which pipeline/stage new contacts should land in

**Booking**
- Cal.com (or Calendly) event type link, webhook secret, and which rep(s) get booked meetings

**Compliance**
- Target regions (US/EU/CA/etc.) to confirm CAN-SPAM/GDPR/CASL requirements
- Do-not-contact list to seed the Suppression table with on day one
- Physical mailing address required for compliant footers

**Access & auth**
- Who on the client's team needs login access, and what auth method they want (Google SSO, email/password, Okta, etc.)

**Infra**
- Preferred hosting (Vercel/AWS/their own), custom domain for the app, Postgres database (managed or self-hosted)

---

## 3. Pitch Guide — Everything This Product Does

### The problem it solves

Most outbound today is a spray-and-pray list plus a generic template. Reply rates are low because the message has nothing to do with what's actually happening at the target company right now. Meanwhile, manually researching "is this company hiring for a role that signals they need what we sell" doesn't scale past a handful of accounts a day.

### The pitch, feature by feature

**1. Real-time signal scanning (not a static list)**
The engine continuously scans public job boards (Greenhouse, Lever) and funding-news feeds for the exact signal that predicts a company needs what you sell — a new hire in a relevant role, a funding round, a hiring keyword. This isn't a purchased list going stale in a spreadsheet; it's live evidence, refreshed on demand.

**2. Waterfall enrichment**
Once a signal fires, the engine automatically finds a real, verified contact at that company (Hunter.io) rather than a generic "info@" inbox — the person actually in a position to act on the signal.

**3. AI-personalized drafting, grounded in the evidence**
Every draft email references the actual signal that triggered it — the real job title, the real company context — not a mail-merge {{first_name}} template. The AI is instructed to only reference facts it was actually given, so nothing gets fabricated.

**4. Human-in-the-loop approval — nothing sends itself**
Every drafted email sits in a review queue. A human reads it, edits if needed, and clicks approve before anything reaches a prospect's inbox. This is the difference between an "AI spam cannon" and a tool a sales team actually trusts.

**5. Suppression list enforcement**
Once someone unsubscribes or asks to stop, they're permanently suppressed — checked automatically before any future draft, even for a brand-new signal. This isn't optional; it's built into the pipeline so a compliance mistake can't happen by accident.

**6. Reply classification and routing**
Incoming replies are automatically read and classified — interested, objection, unsubscribe, or other — and routed accordingly: interested replies get flagged for immediate follow-up, unsubscribes trigger suppression automatically, objections go to a human queue instead of being silently ignored.

**7. Real CRM sync**
Every contact that gets a drafted or sent email is synced into the client's actual CRM (HubSpot, or another platform behind the same interface), so sales has one source of truth instead of a shadow spreadsheet.

**8. Real meeting booking**
When a prospect books time, a real Cal.com webhook captures it automatically and closes the loop — no manual calendar-checking required.

### Why this is agency-grade, not "average"

An average outbound tool sends a templated sequence to a purchased list. This system finds the accounts that are *actually* showing buying intent right now, personalizes based on real evidence, and never sends anything a human hasn't approved — while automatically respecting every opt-out. That's the gap between a tool that gets marked as spam and one that gets replies.

### Recurring revenue angle

- Monthly retainer for signal monitoring + enrichment credit usage
- Per-seat pricing for reps using the approval queue
- Reporting/analytics add-on (reply rates, meetings booked, pipeline sourced)
- Upsell: expand signal sources (patent filings, product launches, exec moves), add SMS follow-up, add a dedicated deliverability/warmup service

### Suggested live demo script

1. Run a signal scan against a real target company on Greenhouse — show the actual open role that fired.
2. Show the waterfall enrichment finding a real, verified contact.
3. Show the AI draft referencing the specific job posting by name.
4. Approve and send (or show the log-only send in a sandbox).
5. Simulate a reply and show it auto-classified and routed.
6. Show the contact appearing in the CRM and, if a meeting was booked, the Cal.com webhook firing.


## Public Pixel sample

The public entry and `/demo` run editable, browser-isolated sample workflows. No live email, payment, CRM update or paid AI request is made. Records reset on reload. Existing provider integrations remain available behind explicit private access. Set `ENABLE_LIVE_DEMO=true`, `DATABASE_URL` and a private `PIXEL_LIVE_ACCESS_TOKEN` of at least 32 characters; authenticate internal requests using the `pixel-live-access` cookie or a Bearer header. Keep provider keys server-side. Public POSTs and APIs are blocked. Do not enable integration mode for anonymous visitors.

Run `npm ci`, `npm test`, `npm run lint`, and `npm run build`. Production uses the linked Vercel project.
