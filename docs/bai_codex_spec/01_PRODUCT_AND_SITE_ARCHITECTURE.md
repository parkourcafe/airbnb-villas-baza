# 01. Product and Site Architecture

## 1. Product definition

### 1.1 Рабочее название

**Bali Accommodation Intelligence (BAI)**

### 1.2 Продуктовая формулировка

BAI показывает, что изменилось на рынке размещения Бали, когда это произошло и на каких наблюдаемых данных основан вывод.

### 1.3 Основная боль

Люди, которые управляют, покупают или исследуют виллы, работают с разрозненными страницами, ручными таблицами и случайными снимками экрана. Они не видят историю рынка и не могут быстро ответить:

- какие объекты появились;
- какие перестали наблюдаться;
- какие изменили цену, рейтинг, контент или позиционирование;
- что происходит в конкретном районе;
- какие объекты стоит проверить вручную;
- кому может понадобиться дополнительный прямой канал продаж;
- какие данные подтверждают вывод.

### 1.4 Первая бизнес-ценность

Для Other Bali:

- построить рабочую карту рынка;
- находить новые партнёрские виллы;
- видеть объекты, которые могут искать альтернативные каналы;
- хранить историю, которую нельзя восстановить задним числом;
- готовить аргументированные предложения владельцам.

Для управляющих компаний:

- следить за конкурентным набором;
- видеть изменения рынка;
- сокращать ручной мониторинг;
- получать регулярные отчёты.

Для инвесторов и девелоперов:

- видеть динамику предложения;
- сравнивать районы;
- строить исследования на наблюдаемой истории, а не на рассказах продавца.

---

## 2. Product scope

### 2.1 MVP входит

1. Закрытый B2B dashboard.
2. Организации, роли и dataset access.
3. Импорт CSV.
4. Нормализация source listings.
5. Canonical properties.
6. Исторические snapshots.
7. Diff engine.
8. Event engine.
9. Listing lifecycle state machine.
10. Overview.
11. Properties table.
12. Property detail.
13. Map.
14. Events feed.
15. Imports and collection runs.
16. Watchlists.
17. Lead notes and stages.
18. Basic reports.
19. CSV export.
20. Data-source compliance registry.
21. Audit log.
22. Test fixtures.
23. English UI.
24. Asia/Makassar display timezone.

### 2.2 Не входит в MVP

- live Airbnb crawler;
- обход CAPTCHA, rate limits или anti-bot controls;
- загрузка и переиспользование чужих фотографий;
- копирование полного описания с внешней платформы без разрешения;
- автоматическое определение незаконности виллы;
- автоматическая массовая рассылка владельцам;
- booking engine;
- платежи;
- occupancy и revenue estimates без лицензированных данных;
- AI scoring, который нельзя объяснить;
- автоматическое объединение всех дублей между источниками;
- mobile app;
- публичный marketplace;
- полноценный API для внешних клиентов;
- billing.

---

## 3. User roles

### 3.1 System owner

Внутренняя роль команды BAI.

Может:

- управлять источниками;
- менять compliance status;
- видеть все datasets;
- создавать организации;
- видеть jobs и system logs;
- вручную объединять properties;
- исправлять parser mappings;
- управлять feature flags.

### 3.2 Organization owner

Владелец клиентской организации.

Может:

- видеть доступные datasets;
- приглашать пользователей;
- назначать роли;
- создавать watchlists;
- создавать reports;
- экспортировать данные;
- управлять настройками организации.

### 3.3 Admin

Почти те же права, кроме удаления организации и передачи ownership.

### 3.4 Analyst

Может:

- смотреть данные;
- работать с filters;
- создавать watchlists;
- делать notes;
- создавать reports и exports;
- менять lead stage.

Не может менять membership, source compliance и system settings.

### 3.5 Viewer

Только чтение и скачивание уже разрешённых reports.

---

## 4. Information architecture

Сайт состоит из двух зон:

```text
Public Website
└── Marketing, methodology, request access, login

Authenticated Application
└── Market intelligence dashboard
```

---

## 5. Public website routes

### 5.1 MVP routes

| Route | Назначение |
|---|---|
| `/` | Главная страница продукта |
| `/methodology` | Как собираются наблюдения и рассчитывается confidence |
| `/data-sources` | Какие типы источников допускаются |
| `/request-access` | Форма beta access |
| `/login` | Вход |
| `/legal/privacy` | Privacy policy |
| `/legal/terms` | Terms |
| `/legal/data-policy` | Политика данных и исправлений |

### 5.2 Routes после MVP

| Route | Назначение |
|---|---|
| `/product/market-watch` | Продукт для управляющих |
| `/product/lead-radar` | Продукт для партнёрских и sales-команд |
| `/product/reports` | Исследования и custom reports |
| `/solutions/property-managers` | Use case |
| `/solutions/investors` | Use case |
| `/solutions/developers` | Use case |
| `/pricing` | Тарифы после проверки модели |
| `/reports/[slug]` | Публичные отчёты, если разрешены |

---

## 6. Public homepage structure

### 6.1 Hero

**Headline:**

> See what changed in Bali accommodation before it becomes obvious.

**Supporting copy:**

> Track new listings, status changes, market movement and competitive sets using evidence-backed historical observations.

**Primary CTA:**

> Request beta access

**Secondary CTA:**

> View methodology

Не использовать:

- “real-time”, если данные не real-time;
- “all villas in Bali”, пока coverage не доказан;
- “removed by Airbnb”, если есть только отсутствие наблюдения;
- “illegal villas”;
- неподтверждённые показатели аудитории.

### 6.2 Product proof

Показать реальный mock/data example:

- 12,438 observed listings;
- 184 new since previous snapshot;
- 27 suspected inactive;
- 63 material changes;
- coverage date;
- confidence labels.

До появления реальных production numbers использовать демонстрационные данные с явной маркировкой `Demo dataset`.

### 6.3 Core modules

1. **Market Watch**  
   Changes in selected areas and comp sets.

2. **Listing Lifecycle**  
   Evidence-backed state changes instead of a simplistic removed/not removed label.

3. **Property History**  
   Timeline of snapshots and changes.

4. **Reports**  
   Exportable evidence for internal decisions.

### 6.4 Methodology and trust

Объяснить:

- data source access modes;
- observation dates;
- confidence;
- known limitations;
- correction process;
- no legal verdict.

### 6.5 Final CTA

> Build your Bali market watchlist.

---

## 7. Authenticated application routes

```text
/app
├── /overview
├── /properties
│   └── /[propertyId]
│       ├── overview
│       ├── listings
│       ├── history
│       ├── evidence
│       └── notes
├── /map
├── /events
├── /snapshots
├── /compare
├── /watchlists
│   └── /[watchlistId]
├── /leads
│   └── /[leadId]
├── /reports
│   └── /[reportId]
├── /imports
│   └── /[importId]
├── /data-sources
├── /jobs
└── /settings
    ├── /organization
    ├── /team
    ├── /notifications
    ├── /data-access
    └── /billing
```

`/billing` скрыт feature flag до появления коммерческого тарифа.

Internal routes:

```text
/admin
├── /datasets
├── /sources
├── /jobs
├── /parsers
├── /entity-resolution
├── /organizations
├── /audit
└── /feature-flags
```

---

## 8. App shell

### 8.1 Desktop

- left sidebar;
- organization switcher;
- dataset selector;
- global date range;
- global search;
- user menu;
- persistent content header;
- page-specific filter bar.

### 8.2 Mobile

MVP должен быть usable, но не обязан превращать плотную аналитику в карманный Bloomberg.

- sidebar становится Sheet;
- tables переходят в cards или horizontal scroll только внутри table container;
- critical actions доступны;
- map и complex compare рекомендуют desktop, но не ломаются;
- никаких горизонтальных scroll на всей странице.

### 8.3 Global search

Ищет по:

- property name;
- source listing title;
- external ID;
- source URL;
- area;
- host external ID;
- official website;
- business WhatsApp;
- tags.

Результаты группируются:

- Properties;
- Listings;
- Events;
- Leads.

---

## 9. Core screens

## 9.1 Overview

### Цель

За 30 секунд показать состояние dataset и последние изменения.

### Components

1. Coverage header:
   - dataset;
   - last successful run;
   - coverage window;
   - source status;
   - data freshness.

2. KPI cards:
   - active listings;
   - new listings;
   - suspected inactive;
   - confirmed inactive;
   - reactivated;
   - material changes.

3. Trend chart:
   - observed active listings by snapshot;
   - selectable region.

4. Area table:
   - region;
   - active;
   - new;
   - suspected inactive;
   - median observed price;
   - median rating;
   - coverage.

5. Event feed.

6. Watchlist alerts.

7. Import health:
   - last run;
   - rows accepted;
   - rejected;
   - source errors.

### Empty state

> Import a baseline snapshot to start building market history.

CTA:

> Import snapshot

---

## 9.2 Properties

### Цель

Рабочая таблица всех canonical properties.

### Columns

- property name;
- primary area;
- property type;
- bedrooms;
- source count;
- active listing count;
- last observed;
- lifecycle status;
- rating;
- review count;
- watchlist;
- lead stage;
- confidence.

### Filters

- dataset;
- region hierarchy;
- source;
- lifecycle status;
- observation status;
- rating range;
- review count range;
- bedroom range;
- property type;
- price range;
- direct website present;
- WhatsApp present;
- owner verified;
- last observed date;
- event type;
- confidence;
- watchlist;
- lead stage.

### Actions

- open property;
- add to watchlist;
- create lead;
- add note;
- compare;
- export selection.

### Pagination

Keyset/cursor pagination, not offset for large datasets.

---

## 9.3 Property detail

### Header

- canonical name;
- area;
- lifecycle badge;
- confidence;
- last observed;
- watchlist button;
- create/update lead;
- merge candidate action for system admin.

### Overview tab

- canonical facts;
- map point;
- source summary;
- latest normalized metrics;
- direct channels;
- tags;
- data quality warnings.

### Listings tab

Одна строка на source listing:

- source;
- external ID;
- URL;
- current observation status;
- lifecycle state;
- first seen;
- last seen;
- latest rating;
- latest reviews;
- latest observed price;
- evidence link.

### History tab

Timeline:

- first observed;
- price changes;
- rating/review changes;
- content changes;
- first miss;
- suspected inactive;
- confirmed inactive;
- reactivated;
- manual corrections.

### Evidence tab

Для каждого event:

- source;
- run ID;
- observed at;
- previous snapshot;
- current snapshot;
- changed fields;
- raw observation reference;
- parser version;
- confidence explanation.

### Notes tab

Organization-private notes with author and timestamps.

---

## 9.4 Map

### Layers

- active;
- new;
- suspected inactive;
- confirmed inactive;
- reactivated;
- watchlist;
- leads.

### Cluster behavior

- cluster at low zoom;
- count by lifecycle;
- click cluster zooms;
- click point opens property preview drawer.

### Filters

Повторяют основные filters Properties.

### Privacy

Точные координаты показываются только если источник и entitlement разрешают это. Иначе координаты округляются или показывается area centroid.

---

## 9.5 Events

### Event types

- listing_created;
- listing_suspected_inactive;
- listing_confirmed_inactive;
- listing_reactivated;
- price_changed;
- rating_changed;
- review_count_changed;
- title_changed;
- content_changed;
- amenities_changed;
- host_changed;
- source_error;
- manual_correction.

### Table columns

- event date;
- property;
- source listing;
- event;
- previous value;
- new value;
- confidence;
- region;
- evidence;
- reviewed status.

### Review action

Analyst может:

- mark reviewed;
- dismiss;
- add note;
- convert to lead;
- add to watchlist;
- correct false positive.

---

## 9.6 Snapshots

Показывает dataset-level snapshots:

- snapshot date;
- source;
- run;
- records;
- active;
- errors;
- rejected;
- new;
- changed;
- suspected;
- confirmed;
- duration;
- parser version.

Можно открыть summary и rejected rows.

---

## 9.7 Compare

Сравнивает два snapshots.

### Summary

- total previous;
- total current;
- intersection;
- only previous;
- only current;
- material changes;
- source errors;
- coverage delta.

### Tabs

- New;
- No longer observed;
- Changed;
- Unchanged;
- Errors.

Фраза `No longer observed` используется вместо `Removed`.

---

## 9.8 Watchlists

Watchlist содержит:

- properties;
- source listings;
- regions;
- saved filters.

Examples:

- Uluwatu high-rated villas;
- Other Bali priority outreach;
- Canggu comp set;
- suspected inactive;
- owner-verified partners.

Watchlist может иметь notification rule.

---

## 9.9 Leads

CRM-light, а не полноценный CRM.

### Lead fields

- property;
- contact name;
- role;
- business email;
- business WhatsApp;
- website;
- Instagram;
- source URL;
- lead stage;
- priority;
- reason;
- assigned user;
- last activity;
- next action;
- do-not-contact;
- notes.

### Lead stages

- new;
- research;
- ready_to_contact;
- contacted;
- replied;
- qualified;
- converted;
- not_relevant;
- do_not_contact.

### Restrictions

- никакой массовой рассылки в MVP;
- contact data только business/public/owner-provided;
- хранить source attribution;
- do-not-contact обязателен;
- исчезновение листинга не является доказательством проблемы.

---

## 9.10 Reports

MVP report types:

1. Snapshot summary.
2. Region change report.
3. Watchlist report.
4. Property history report.
5. Event evidence report.

Output:

- web preview;
- CSV;
- PDF generation can be v1.1;
- report metadata and immutable parameters.

---

## 9.11 Imports

Upload flow:

1. choose dataset;
2. choose source;
3. upload CSV;
4. map columns;
5. preview validation;
6. confirm import;
7. async processing;
8. view results;
9. download rejected rows.

Status:

- uploaded;
- validating;
- ready;
- processing;
- completed;
- completed_with_errors;
- failed;
- cancelled.

---

## 9.12 Data Sources

Visible information:

- source name;
- access mode;
- compliance status;
- automation allowed;
- last review;
- capabilities;
- last successful run;
- health;
- parser version.

Only system owner can change compliance status.

---

## 9.13 Jobs

Internal operational screen.

Columns:

- job ID;
- type;
- source;
- dataset;
- priority;
- status;
- attempts;
- scheduled for;
- started;
- finished;
- worker;
- error summary.

Actions:

- retry;
- cancel queued job;
- inspect logs.

---

## 10. Core user flows

## 10.1 First baseline import

```text
Login
→ Create/select organization
→ Select dataset
→ Upload baseline CSV
→ Map fields
→ Validate
→ Confirm
→ Background import
→ Properties and source listings created
→ First snapshots created
→ No change events generated except listing_created if configured
→ Overview becomes available
```

## 10.2 Second snapshot

```text
Upload follow-up CSV
→ Normalize
→ Match source listings
→ Create snapshots
→ Compare with previous valid snapshot
→ Generate diffs
→ Generate events
→ Update lifecycle state
→ Update Overview
```

## 10.3 Investigate a potentially inactive listing

```text
Event feed
→ Open suspected inactive event
→ Review evidence
→ Inspect observation history
→ Check source errors
→ Add to watchlist or lead
→ Mark reviewed
```

## 10.4 Correct a false match

```text
Property detail
→ Admin opens entity resolution
→ Split or merge source listing
→ Recompute affected canonical summary
→ Preserve audit trail
```

---

## 11. Design system

Existing Other Bali visual identity should inform the product:

- deep teal: `#005962`;
- warm ivory: `#FAF6EF`;
- coral accent: `#E08A5E`;
- dark brown: `#2B1A13`;
- body font: Hanken Grotesk when available;
- editorial headings: Young Serif when available.

### Application adaptation

- public site may use Young Serif for headlines;
- app UI uses Hanken Grotesk or Geist for clarity;
- metrics/IDs/timestamps may use Geist Mono;
- app background: warm neutral, not pure white;
- sidebar: deep teal;
- coral only for CTA/highlight, not every warning;
- status palette must remain accessible and not imply illegality.

### Status language

| Internal state | UI label |
|---|---|
| active | Active |
| first_miss | First miss |
| suspected_inactive | Suspected inactive |
| confirmed_inactive | Likely inactive |
| reactivated | Reactivated |
| search_not_observed | Not observed in search |
| source_error | Source error |

Do not show `Removed by Airbnb` unless there is authoritative evidence.

### Accessibility

- WCAG AA contrast;
- keyboard access;
- visible focus;
- semantic table and button elements;
- charts have textual summaries;
- status is not communicated only by color;
- every icon has accessible name or is decorative.

---

## 12. Analytics events

Track product usage, not guest PII.

```text
public_home_view
request_access_click
login_success
dataset_selected
overview_view
properties_filter_applied
property_opened
event_opened
event_marked_reviewed
watchlist_created
watchlist_item_added
lead_created
lead_stage_changed
import_started
import_validated
import_completed
import_failed
compare_run
report_created
export_started
export_completed
```

Each event includes:

- organization_id;
- user_id;
- dataset_id where applicable;
- timestamp;
- route;
- non-sensitive metadata.

---

## 13. Product copy rules

1. Use observation language.
2. Show dates.
3. Show confidence.
4. Show evidence.
5. Separate extracted facts from interpretation.
6. Never claim cause from correlation.
7. Never label a property illegal based on platform visibility.
8. Never imply complete market coverage without coverage evidence.
9. Use `observed price`, not `revenue`.
10. Use `likely inactive`, not `closed`.

---

## 14. MVP success metrics

Operational:

- at least 25,000 rows can be imported asynchronously;
- repeat import is idempotent;
- events are deterministic;
- no cross-organization data leakage;
- every event has evidence;
- source errors do not generate inactivity;
- manual correction is auditable.

Product:

- analyst can answer “what changed since the last snapshot?” in under two minutes;
- analyst can find all high-confidence likely inactive listings in a selected area;
- analyst can create a watchlist and export it;
- Other Bali team can create a lead from an evidence-backed event.
