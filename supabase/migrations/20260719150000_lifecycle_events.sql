-- ---------------------------------------------------------------------------
-- Milestone 5: lifecycle reducer auxiliary state
--
-- The lifecycle reducer (04 §18) needs a little tracking state that is not part
-- of the authoritative projection columns: the start of the current miss
-- sequence, how many distinct runs contributed a miss, whether a high-confidence
-- direct not_found has been seen, and a monotonic transition counter used for
-- deterministic event dedupe keys. It is stored as jsonb so thresholds/rules can
-- evolve under a new rule version without a schema change, and it is never
-- treated as an authoritative status on its own.
-- ---------------------------------------------------------------------------
alter table public.source_listings
  add column lifecycle_state jsonb not null default '{}';

comment on column public.source_listings.lifecycle_state is
  'Auxiliary lifecycle-reducer tracking (miss-sequence start, distinct miss runs, high-confidence not_found seen, transition sequence). Rule-versioned; not an authoritative status.';
