# 07. Source Compliance and Data Policy

## 1. Purpose

BAI must remain useful even when a source is unavailable, changes terms, changes HTML or revokes access.

No source may become a hidden hard dependency.

---

## 2. Source categories

### 2.1 Owner supplied

Examples:

- villa owner submits property details;
- owner provides photos;
- owner provides direct links;
- management company exports its portfolio.

Default:

- automation allowed only within granted scope;
- content display allowed according to owner agreement;
- high trust for ownership/direct channels;
- corrections accepted.

### 2.2 Licensed API/provider

Examples:

- commercial market data provider;
- authorized integration;
- partner feed.

Default:

- enabled only after contract review;
- obey field, retention, display and redistribution limits;
- store license metadata;
- adapter capability limited to contract.

### 2.3 Public registry

Examples:

- government open data;
- public licensing registry with lawful reuse.

Default:

- record dataset license/version;
- preserve source and update date;
- do not over-interpret.

### 2.4 Manual import

Examples:

- analyst-created CSV;
- purchased export;
- verified spreadsheet.

Default:

- uploader confirms rights/authority;
- provenance required;
- source key and observation date required.

### 2.5 Browser automation

Highest-risk mode.

Default:

- disabled;
- requires explicit legal/terms review;
- requires compliance status approved;
- no circumvention;
- rate limits;
- kill switch;
- review expiry.

### 2.6 Demo fixture

Local controlled data only.

Default:

- approved;
- never mixed invisibly with production;
- clearly labelled.

---

## 3. Source registry required fields

Each source has:

- key;
- display name;
- access mode;
- compliance status;
- automation allowed;
- approved capabilities;
- terms reviewed at;
- review expires at;
- reviewer;
- restriction reason;
- retention limits;
- display limits;
- redistribution limits;
- rate-limit policy;
- parser version;
- kill switch.

---

## 4. Airbnb-specific default

As of the architecture date, Airbnb terms state that users must not use bots, crawlers, scrapers or other automated means to access or collect platform data/content, and platform content is limited to authorized use.

Therefore seed configuration is:

```yaml
key: airbnb
access_mode: browser_automation
compliance_status: disabled
automation_allowed: false
capabilities: []
restriction_reason: >
  Live automated collection is disabled pending a separate written
  authorization, licensed provider arrangement or legal approval.
```

Codex must not implement:

- live Airbnb crawler;
- CAPTCHA bypass;
- anti-bot evasion;
- rotating proxy evasion;
- undocumented private API extraction;
- copied photo/content republication;
- host messaging automation.

The domain model may contain an `airbnb` source record so licensed/manual data can be represented without changing architecture.

---

## 5. Booking/Agoda/other OTA default

Do not assume permission.

Seed as:

```yaml
compliance_status: pending_review
automation_allowed: false
```

Enable only after source-specific review.

---

## 6. Compliance gate behavior

Before every automated job:

1. load source definition;
2. verify approved;
3. verify automation allowed;
4. verify review not expired;
5. verify requested capability allowed;
6. verify required agreement/config present;
7. record compliance decision in job log;
8. proceed or fail permanently.

Pseudocode:

```ts
export function assertSourceExecutionAllowed(
  source: SourceDefinition,
  requestedCapabilities: SourceCapability[],
  now = new Date()
): void {
  if (source.complianceStatus !== "approved") {
    throw new PermanentJobError(
      "SOURCE_NOT_APPROVED",
      `Source ${source.key} is ${source.complianceStatus}`
    );
  }

  if (!source.automationAllowed) {
    throw new PermanentJobError(
      "AUTOMATION_NOT_ALLOWED",
      `Automation disabled for ${source.key}`
    );
  }

  if (
    source.reviewExpiresAt &&
    new Date(source.reviewExpiresAt) <= now
  ) {
    throw new PermanentJobError(
      "SOURCE_REVIEW_EXPIRED",
      `Compliance review expired for ${source.key}`
    );
  }

  for (const capability of requestedCapabilities) {
    if (!source.capabilities.includes(capability)) {
      throw new PermanentJobError(
        "CAPABILITY_NOT_APPROVED",
        `${capability} not approved for ${source.key}`
      );
    }
  }
}
```

---

## 7. Data provenance

Every observation must store:

- source;
- source mode;
- observation time;
- run;
- parser;
- raw evidence reference;
- uploader/provider where applicable;
- license/provenance metadata;
- field-level presence;
- quality flags.

---

## 8. Copyright and content

Do not rehost or publish:

- third-party photos;
- full descriptions;
- logos;
- protected page layout;
- reviews;

unless:

- owner supplied;
- licensed;
- clearly permitted.

BAI can store normalized facts and hashes where permitted, but legal review still controls source use.

---

## 9. Personal and contact data

MVP stores only necessary business contact data.

Rules:

- no guest data;
- no private host contact scraped from platform;
- business/public or owner-provided contact only;
- source attribution;
- correction/deletion workflow;
- do-not-contact;
- least retention;
- access logs;
- no automatic commercial messages.

---

## 10. Claims policy

Allowed:

- observed;
- not observed;
- source returned not found;
- likely inactive;
- source error;
- coverage degraded;
- direct channel present;
- rating changed.

Not allowed without authoritative evidence:

- illegal;
- unlicensed;
- tax evasion;
- removed for non-compliance;
- banned;
- fraudulent;
- permanently closed.

---

## 11. Correction workflow

Property operator can submit correction request.

Record:

- requester;
- relationship to property;
- disputed field/event;
- evidence;
- resolution;
- reviewer;
- date.

Correction updates derived projection or owner-verified facts. Original observation remains immutable.

---

## 12. Source shutdown

System owner can immediately:

- disable source;
- cancel queued jobs;
- stop active jobs through cancellation flag;
- hide affected raw content;
- preserve audit;
- mark dataset freshness.

No code deployment should be required to disable a source.

---

## 13. Review cadence

- browser automation: before activation and at least every 90 days;
- licensed provider: contract renewal/change;
- public registry: when license/version changes;
- owner supplied: agreement version change;
- manual imports: provenance assertion per upload.

---

## 14. Operational rule

The product must be able to deliver value from CSV and licensed/owner data alone.

If it cannot, the architecture has failed by making a risky source the product instead of making data history the product.
