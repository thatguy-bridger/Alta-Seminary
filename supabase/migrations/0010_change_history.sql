-- Site-wide change history: every insert/update/delete on admin-editable content
-- gets a signed entry (who + when) and can be undone. Reuses the exact trigger
-- shape log_publish_event() already established in 0001_init.sql (security
-- definer function, tg_argv[0] carries the table name) rather than a new pattern.
--
-- Granularity: rapid edits by the same admin on the same record (e.g. the
-- page builder's ~1s autosave while typing) coalesce into a single 'update'
-- row instead of flooding the log -- see the 10-minute window below. A status
-- change (draft <-> published) always starts a fresh row, since that's the
-- meaningful, distinct event admins actually care about.

create type change_action as enum ('insert', 'update', 'delete', 'undo');

create table public.change_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  record_label text,                 -- human-readable snapshot; survives the record being renamed or deleted later
  action change_action not null,
  before_data jsonb,                 -- full row before the change (null for insert)
  after_data jsonb,                  -- full row after the change (null for delete)
  changed_by uuid references auth.users(id),
  changed_by_email text,             -- denormalized signature -- still readable if the admin account is later removed
  changed_by_name text,
  reverted_change_id uuid references public.change_log(id),    -- set on an 'undo' row: which row it reverted
  reverted_by_change_id uuid references public.change_log(id), -- set on the original row once something has undone it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index change_log_created_at_idx on public.change_log (created_at desc);
create index change_log_table_record_idx on public.change_log (table_name, record_id);

-- ============================================================
-- Change-tracking trigger, attached below to every admin-editable table
-- ============================================================

-- Per-table "what's the human-readable name of this row" lookup, shared by
-- the trigger and by undo_change() when it writes the undo entry.
create or replace function public.change_log_label(p_table text, p_data jsonb)
returns text
language sql
stable
as $$
  select case p_table
    when 'pages' then p_data->>'title'
    when 'blog_posts' then p_data->>'title'
    when 'directory_entries' then p_data->>'name'
    when 'directories' then p_data->>'name'
    when 'directory_field_definitions' then p_data->>'label'
    when 'gallery_albums' then p_data->>'name'
    when 'gallery_photos' then coalesce(p_data->>'caption', p_data->>'alt_text')
    when 'calendar_events' then p_data->>'title'
    when 'admin_profiles' then coalesce(p_data->>'display_name', p_data->>'email')
    when 'site_settings' then 'Site settings'
    else null
  end;
$$;

create or replace function public.log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text := tg_argv[0];
  v_actor uuid := auth.uid();
  v_email text;
  v_name text;
  v_existing_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  -- undo_change() sets this before it makes its own corrective write, so that
  -- write doesn't also get logged as an ordinary (and misleading) entry.
  if coalesce(current_setting('app.suppress_change_log', true), '') = 'true' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    if v_old = v_new then
      return new;
    end if;
  end if;

  -- The admin_profiles row for a brand-new invite is inserted by the
  -- invite-admin Edge Function using the service-role key, which has no
  -- user JWT -- auth.uid() is null there. Fall back to invited_by, which
  -- that function already records, so the invite still gets a signature.
  if v_actor is null and v_table = 'admin_profiles' and tg_op = 'INSERT' then
    v_actor := new.invited_by;
  end if;

  if v_actor is not null then
    select email into v_email from auth.users where id = v_actor;
    select display_name into v_name from public.admin_profiles where id = v_actor;
  end if;

  if tg_op = 'INSERT' then
    insert into public.change_log (table_name, record_id, record_label, action, after_data, changed_by, changed_by_email, changed_by_name)
    values (v_table, new.id, public.change_log_label(v_table, to_jsonb(new)), 'insert', to_jsonb(new), v_actor, v_email, v_name);
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.change_log (table_name, record_id, record_label, action, before_data, changed_by, changed_by_email, changed_by_name)
    values (v_table, old.id, public.change_log_label(v_table, to_jsonb(old)), 'delete', to_jsonb(old), v_actor, v_email, v_name);
    return old;
  end if;

  -- tg_op = 'UPDATE' from here. A status flip (draft <-> published, or any
  -- other status-bearing table) is always its own fresh entry.
  if v_old->>'status' is distinct from v_new->>'status' then
    insert into public.change_log (table_name, record_id, record_label, action, before_data, after_data, changed_by, changed_by_email, changed_by_name)
    values (v_table, new.id, public.change_log_label(v_table, v_new), 'update', v_old, v_new, v_actor, v_email, v_name);
    return new;
  end if;

  -- Otherwise, coalesce into the same admin's still-open editing session for
  -- this record if one exists (extends the window rather than resetting it,
  -- so one continuous editing stretch stays one entry).
  select id into v_existing_id
  from public.change_log
  where table_name = v_table and record_id = new.id and action = 'update'
    and changed_by is not distinct from v_actor
    and reverted_by_change_id is null
    and updated_at > now() - interval '10 minutes'
  order by updated_at desc
  limit 1;

  if v_existing_id is not null then
    update public.change_log
    set after_data = v_new, record_label = public.change_log_label(v_table, v_new), updated_at = now()
    where id = v_existing_id;
  else
    insert into public.change_log (table_name, record_id, record_label, action, before_data, after_data, changed_by, changed_by_email, changed_by_name)
    values (v_table, new.id, public.change_log_label(v_table, v_new), 'update', v_old, v_new, v_actor, v_email, v_name);
  end if;

  return new;
end;
$$;

create trigger trg_pages_change after insert or update or delete on public.pages
  for each row execute function public.log_change('pages');
create trigger trg_blog_posts_change after insert or update or delete on public.blog_posts
  for each row execute function public.log_change('blog_posts');
create trigger trg_directory_entries_change after insert or update or delete on public.directory_entries
  for each row execute function public.log_change('directory_entries');
create trigger trg_directories_change after insert or update or delete on public.directories
  for each row execute function public.log_change('directories');
create trigger trg_directory_field_definitions_change after insert or update or delete on public.directory_field_definitions
  for each row execute function public.log_change('directory_field_definitions');
create trigger trg_gallery_albums_change after insert or update or delete on public.gallery_albums
  for each row execute function public.log_change('gallery_albums');
create trigger trg_gallery_photos_change after insert or update or delete on public.gallery_photos
  for each row execute function public.log_change('gallery_photos');
create trigger trg_calendar_events_change after insert or update or delete on public.calendar_events
  for each row execute function public.log_change('calendar_events');
create trigger trg_site_settings_change after insert or update or delete on public.site_settings
  for each row execute function public.log_change('site_settings');
create trigger trg_admin_profiles_change after insert or update or delete on public.admin_profiles
  for each row execute function public.log_change('admin_profiles');

-- ============================================================
-- Undo -- restores a change_log row's `before_data` (or removes/re-inserts
-- the record for insert/delete rows), then logs that restoration as its own
-- signed 'undo' entry. One level deep only: an 'undo' row can't itself be
-- undone, so this stays a simple audit trail rather than a redo stack.
-- ============================================================

create or replace function public.undo_change(p_change_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ch public.change_log%rowtype;
  v_actor uuid := auth.uid();
  v_email text;
  v_name text;
  v_current jsonb;
  v_restored jsonb;
  v_col_list text;
  v_undo_id uuid;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select * into ch from public.change_log where id = p_change_id for update;
  if not found then
    raise exception 'Change not found';
  end if;
  if ch.reverted_by_change_id is not null then
    raise exception 'This change has already been undone';
  end if;
  if ch.action = 'undo' then
    raise exception 'Cannot undo an undo';
  end if;

  select email into v_email from auth.users where id = v_actor;
  select display_name into v_name from public.admin_profiles where id = v_actor;

  -- Scoped to this transaction only (the `true` third argument) -- resets
  -- automatically once undo_change() returns.
  perform set_config('app.suppress_change_log', 'true', true);

  if ch.action = 'insert' then
    execute format('select to_jsonb(t) from public.%I t where id = $1', ch.table_name) into v_current using ch.record_id;
    execute format('delete from public.%I where id = $1', ch.table_name) using ch.record_id;
    v_restored := null;

  elsif ch.action = 'delete' then
    v_current := null;
    execute format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)',
      ch.table_name, ch.table_name
    ) using ch.before_data;
    v_restored := ch.before_data;

  elsif ch.action = 'update' then
    execute format('select to_jsonb(t) from public.%I t where id = $1', ch.table_name) into v_current using ch.record_id;
    if v_current is null then
      raise exception 'The record for this change no longer exists';
    end if;

    -- Column list (everything but id) computed at call time so one code
    -- path covers every instrumented table regardless of its shape.
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_col_list
    from information_schema.columns
    where table_schema = 'public' and table_name = ch.table_name and column_name <> 'id';

    execute format(
      'update public.%I set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where id = $2',
      ch.table_name, v_col_list, v_col_list, ch.table_name
    ) using ch.before_data, ch.record_id;
    v_restored := ch.before_data;
  end if;

  insert into public.change_log (table_name, record_id, record_label, action, before_data, after_data, changed_by, changed_by_email, changed_by_name, reverted_change_id)
  values (
    ch.table_name, ch.record_id, public.change_log_label(ch.table_name, coalesce(v_restored, v_current)),
    'undo', v_current, v_restored, v_actor, v_email, v_name, ch.id
  )
  returning id into v_undo_id;

  update public.change_log set reverted_by_change_id = v_undo_id where id = ch.id;
end;
$$;

revoke all on function public.undo_change(uuid) from public;
grant execute on function public.undo_change(uuid) to authenticated;

-- ============================================================
-- Row Level Security -- reads only via RLS; all writes go through the
-- security-definer trigger/RPC above, exactly like publish_events in 0001_init.sql.
-- ============================================================
alter table public.change_log enable row level security;
create policy "admin read change log" on public.change_log for select using (auth.role() = 'authenticated');
