-- Each branch can word its own arrival message. Null means the shared
-- template in message_templates ('arrival') is used.
alter table branches add column arrival_template text;
