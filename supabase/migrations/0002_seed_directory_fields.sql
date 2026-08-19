-- Starter catalog of optional directory fields. Admins pick from these when adding
-- a field to a Council/Missionary/Staff entry beyond the required photo/name/bio.
-- Add more rows any time — this table is just a lookup, not a fixed schema.

insert into public.directory_field_definitions (directory_kind, field_key, label, input_type, sort_order) values
  (null, 'role', 'Role / Title', 'text', 1),
  (null, 'email', 'Email', 'email', 2),
  (null, 'phone', 'Phone', 'phone', 3),
  ('missionary', 'mission_location', 'Mission Location', 'text', 10),
  ('missionary', 'mission_dates', 'Mission Dates', 'date_range', 11),
  ('staff', 'subject_taught', 'Subject / Class', 'text', 10),
  ('council', 'term', 'Term / Year', 'text', 10)
on conflict (directory_kind, field_key) do nothing;
