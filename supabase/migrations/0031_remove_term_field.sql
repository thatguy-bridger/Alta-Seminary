-- "Term / Year" is no longer a directory field. Remove its definition (so it
-- stops appearing in the directory editor) and the stray stored values (so it
-- can't resurface in a card or the preview dialog, which list whatever is in
-- an entry's extra_fields).
delete from public.directory_field_definitions where field_key = 'term';
update public.directory_entries set extra_fields = extra_fields - 'term' where extra_fields ? 'term';
