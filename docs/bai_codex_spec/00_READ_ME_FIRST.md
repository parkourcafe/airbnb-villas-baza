# Bali Accommodation Intelligence
## Пакет архитектуры и технического задания для Codex

**Рабочее название:** Bali Accommodation Intelligence  
**Сокращение:** BAI  
**Версия документа:** 1.0  
**Дата фиксации:** 18 июля 2026  
**Язык интерфейса MVP:** английский  
**Часовой пояс отображения:** Asia/Makassar  
**Хранение времени в базе:** UTC

---

## 1. Что мы строим

BAI - это система исторической и событийной аналитики для рынка размещения Бали.

Она должна:

1. принимать повторные снимки данных из разрешённых источников;
2. нормализовать сведения о виллах и других объектах размещения;
3. хранить историю изменений;
4. сравнивать снимки;
5. находить новые, изменившиеся, временно недоступные и предположительно неактивные листинги;
6. показывать доказательства каждого вывода;
7. давать Other Bali, управляющим компаниям, аналитикам и инвесторам рабочий кабинет для поиска, фильтрации, watchlist, отчётов и лидов.

BAI не должен делать юридические выводы о том, является ли вилла незаконной или почему листинг перестал отображаться.

---

## 2. Главный архитектурный принцип

Система строится не вокруг Airbnb, а вокруг универсальной модели:

```text
Physical Property
    └── Source Listing
            └── Observation / Snapshot
                    └── Diff
                            └── Event
```

Один физический объект позднее сможет иметь листинги в разных источниках:

```text
Villa Serene
├── Airbnb listing
├── Booking.com property
├── Agoda property
├── Google place
├── Official website
└── Other Bali profile
```

Первый MVP должен работать без привязки к конкретному внешнему сайту. Данные загружаются через CSV, fixtures, owner-supplied data, licensed APIs и другие явно разрешённые каналы.

---

## 3. Что Codex должен сделать первым

Codex не должен начинать с live-коллектора.

Правильная последовательность:

1. создать монорепозиторий;
2. поднять веб-приложение и базу;
3. реализовать аутентификацию и организационную модель;
4. реализовать импорт CSV;
5. реализовать snapshot engine;
6. реализовать diff и event engine;
7. собрать основные экраны;
8. добавить worker и очередь задач;
9. добавить универсальный Source Adapter SDK;
10. проверить систему на fixtures;
11. только после отдельного разрешения подключать конкретный внешний источник.

---

## 4. Решения, которые уже приняты

| Область | Решение |
|---|---|
| Web framework | Next.js App Router, TypeScript |
| Runtime | Node.js 24 LTS |
| Package manager | pnpm |
| Monorepo | Turborepo |
| Database/Auth/Storage | Supabase |
| UI primitives | shadcn/ui |
| Styling | Tailwind CSS |
| Validation | Zod |
| Forms | React Hook Form + Zod |
| Worker | Отдельный long-running Node.js process |
| Scheduler | Vercel Cron только ставит задачи в очередь |
| Job queue MVP | PostgreSQL table queue с `FOR UPDATE SKIP LOCKED` |
| Geospatial | PostGIS |
| Map | MapLibre, tile provider configurable |
| Unit tests | Vitest |
| Browser/E2E tests | Playwright Test |
| Hosting web | Vercel |
| Hosting worker | Любая container platform с long-running process |
| Time storage | UTC |
| User display timezone | Asia/Makassar |
| Initial source | CSV / fixtures / approved data source |
| Unauthorized scraping | Запрещён и не входит в MVP |

---

## 5. Состав пакета

- `01_PRODUCT_AND_SITE_ARCHITECTURE.md` - продукт, роли, страницы, навигация и UX.
- `02_SYSTEM_ARCHITECTURE.md` - сервисы, монорепозиторий, инфраструктура и pipeline.
- `03_DATABASE_SCHEMA.md` - таблицы, поля, индексы и RLS.
- `04_EVENT_AND_REMOVAL_ENGINE.md` - правила сравнения и state machine.
- `05_CODEX_IMPLEMENTATION_PLAN.md` - этапы работы для Codex.
- `06_ACCEPTANCE_TESTS.md` - обязательные проверки.
- `07_SOURCE_COMPLIANCE.md` - правила допуска источников.
- `AGENTS.md` - постоянные инструкции Codex внутри репозитория.
- `fixtures/` - тестовые снимки для первого end-to-end сценария.
- `BAI_MASTER_SPEC.md` - единый объединённый документ.

---

## 6. Как запускать работу в Codex

1. Создать пустой Git-репозиторий.
2. Положить все файлы этого пакета в корень.
3. Открыть Codex в корне репозитория.
4. Дать ему команду:

```text
Read AGENTS.md and all BAI specification files.
Implement Milestone 0 only from 05_CODEX_IMPLEMENTATION_PLAN.md.
Do not start any later milestone.
Run every required verification command.
Return:
1. files changed;
2. commands run;
3. test results;
4. unresolved decisions;
5. exact next milestone.
```

5. После проверки каждого этапа запускать следующий milestone отдельно.

Не давать команду «сделай весь проект». Такая команда экономит одно предложение и создаёт неделю археологии.

---

## 7. Definition of Done для всего MVP

MVP считается готовым, когда:

- пользователь может войти;
- пользователь видит только данные доступной ему организации и dataset;
- можно импортировать baseline CSV;
- можно импортировать следующий снимок;
- импорт идемпотентен;
- создаются snapshots;
- создаются events;
- отсутствие в поисковой выдаче не называется удалением;
- source errors не считаются пропуском листинга;
- повторные подтверждённые наблюдения переводят листинг в `confirmed_inactive`;
- повторное появление создаёт `reactivated`;
- есть Overview, Properties, Property Detail, Events, Imports, Watchlists и Reports;
- можно экспортировать отфильтрованные данные;
- каждое событие содержит evidence;
- все чувствительные данные защищены;
- cron endpoint защищён секретом;
- live-автоматизация запрещённого источника отсутствует;
- lint, typecheck, unit tests, integration tests, E2E и production build проходят.

---

## 8. Что не следует менять без отдельного решения

- универсальную модель `Property -> Source Listing -> Snapshot -> Event`;
- distinction между `search_not_observed` и `not_found`;
- трёхступенчатое подтверждение неактивности;
- хранение evidence;
- compliance gate перед запуском адаптера;
- отдельный worker;
- multi-tenant модель;
- запрет на вывод «illegal» или «removed for non-compliance» без официальных данных;
- отсутствие платёжной системы в MVP.
