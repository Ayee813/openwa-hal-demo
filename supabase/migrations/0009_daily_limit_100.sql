-- A calmer daily ceiling per branch number, so WhatsApp doesn't flag it for
-- spam. A new number ramps up even lower (20 / 40 / 80 on its first three days,
-- see lib/pacing.ts). An admin can still raise a single branch afterwards.
alter table branches alter column daily_limit set default 100;
update branches set daily_limit = 100 where daily_limit = 200;
