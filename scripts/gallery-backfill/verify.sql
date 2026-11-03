-- Checks for the image library's database rules (migration 0047). Run each block in the Supabase SQL editor, for example after moving to a
-- new project. Every block ends by raising an error on purpose, so NOTHING IS SAVED; the error message is the result, and the line
-- you want to see is given above each block. (These are the same checks that were run against the live database when it was built.)

-- 1. The public gets nothing. Expect every word to be "denied":
--    anon_select_table=denied; anon_select_usage=denied; anon_select_tags=denied; anon_rpc=denied; anon_insert=denied; anon_update=denied; anon_delete=denied; anon_config=denied;
do $$
declare r text := '';
begin
  set local role anon;
  begin perform 1 from public.media_library limit 1; r := r || 'anon_select_table=ALLOWED; '; exception when others then r := r || 'anon_select_table=denied; '; end;
  begin perform 1 from public.media_library_usage limit 1; r := r || 'anon_select_usage=ALLOWED; '; exception when others then r := r || 'anon_select_usage=denied; '; end;
  begin perform 1 from public.media_library_tag_counts limit 1; r := r || 'anon_select_tags=ALLOWED; '; exception when others then r := r || 'anon_select_tags=denied; '; end;
  begin perform 1 from public.search_media_library('x'); r := r || 'anon_rpc=ALLOWED; '; exception when others then r := r || 'anon_rpc=denied; '; end;
  begin insert into public.media_library (url, origin) values ('https://x.test/a.png', 'linked'); r := r || 'anon_insert=ALLOWED; '; exception when others then r := r || 'anon_insert=denied; '; end;
  begin update public.media_library set title = 'x'; r := r || 'anon_update=ALLOWED; '; exception when others then r := r || 'anon_update=denied; '; end;
  begin delete from public.media_library; r := r || 'anon_delete=ALLOWED; '; exception when others then r := r || 'anon_delete=denied; '; end;
  begin perform 1 from public.media_config; r := r || 'anon_config=ALLOWED; '; exception when others then r := r || 'anon_config=denied; '; end;
  reset role;
  raise exception '%', r;
end $$;

-- 2. A signed-in admin can read, search and describe pictures, but cannot change an address or where a picture came from.
--    Expect: auth_select=<number of pictures>; tags_cleaned=alpha,beta; change_url=blocked; change_origin=blocked; find_by_description_prefix=1; find_by_tag=1; wrong_tag=0;
do $$
declare r text := ''; n int; t text; mid uuid;
begin
  perform set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000000"}', true);
  set local role authenticated;
  select count(*) into n from public.media_library; r := r || 'auth_select=' || n || '; ';
  insert into public.media_library (url, origin, title, tags) values ('https://x.test/probe.png', 'linked', 'Probe  ', array['  Alpha', 'alpha', 'BETA', '']) returning id into mid;
  select array_to_string(tags, ',') into t from public.media_library where id = mid; r := r || 'tags_cleaned=' || t || '; ';
  begin update public.media_library set url = 'https://x.test/changed.png' where id = mid; r := r || 'change_url=ALLOWED; '; exception when others then r := r || 'change_url=blocked; '; end;
  begin update public.media_library set origin = 'uploaded' where id = mid; r := r || 'change_origin=ALLOWED; '; exception when others then r := r || 'change_origin=blocked; '; end;
  update public.media_library set description = 'Painting by Bloch of the garden' where id = mid;
  select count(*) into n from public.search_media_library('bloc garden'); r := r || 'find_by_description_prefix=' || n || '; ';
  select count(*) into n from public.search_media_library('probe', 'alpha'); r := r || 'find_by_tag=' || n || '; ';
  select count(*) into n from public.search_media_library('probe', 'gamma'); r := r || 'wrong_tag=' || n || '; ';
  delete from public.media_library where id = mid;
  reset role;
  raise exception '%', r;
end $$;

-- 3. Anything that lands in the images bucket is registered, even with no details; another bucket is not. (Needs media_config to be set.)
--    Expect: images_bucket_upload_registered=1; null_metadata_registered=1; documents_bucket_registered=0;
do $$
declare r text := ''; n int;
begin
  insert into storage.objects (bucket_id, name, metadata) values ('images', 'zz-probe/test.webp', '{"mimetype":"image/webp","size":123}'::jsonb);
  select count(*) into n from public.media_library where storage_path = 'zz-probe/test.webp' and origin = 'uploaded' and size_bytes = 123 and mime_type = 'image/webp'; r := r || 'images_bucket_upload_registered=' || n || '; ';
  insert into storage.objects (bucket_id, name, metadata) values ('images', 'zz-probe/no-details.webp', null);
  select count(*) into n from public.media_library where storage_path = 'zz-probe/no-details.webp'; r := r || 'null_metadata_registered=' || n || '; ';
  insert into storage.objects (bucket_id, name, metadata) values ('documents', 'zz-probe/doc.pdf', '{}'::jsonb);
  select count(*) into n from public.media_library where storage_path = 'zz-probe/doc.pdf'; r := r || 'documents_bucket_registered=' || n || '; ';
  raise exception '%', r;
end $$;

-- 4. Nothing was left behind by the checks above. Expect leftover_probe_files=0 and leftover_probe_rows=0.
select (select count(*) from storage.objects where name like 'zz-probe%') as leftover_probe_files,
       (select count(*) from public.media_library where storage_path like 'zz-probe%' or url like 'https://x.test/%') as leftover_probe_rows;
