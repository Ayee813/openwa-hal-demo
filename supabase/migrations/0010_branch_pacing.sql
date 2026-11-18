-- Each branch's own sending pace (gaps, rests, hourly limit; see lib/pacing.ts).
-- Null means the standard pace. The daily limit keeps its own column. The app
-- checks every value against fixed bounds before saving and again when reading.
alter table branches add column pacing jsonb;
