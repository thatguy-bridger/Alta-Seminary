-- Makeup Work must not lock students out just because nobody has added a class yet.
--
-- 1. A class can exist without a teacher email. Submissions are still saved; the admin list says
--    the class has no teacher address (makeup-notify records that and sends nothing).
-- 2. If there are no classes at all, add one general class so the student page works immediately.
--    Rename it, add the real classes, and set teacher emails whenever you like.

alter table public.makeup_classes alter column teacher_email drop not null;

insert into public.makeup_classes (name, teacher_email, active, sort_order)
select 'Alta Seminary', null, true, 0
where not exists (select 1 from public.makeup_classes);
