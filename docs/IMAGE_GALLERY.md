# The image library

Every picture used on the site lives in one searchable library, on the admin **Gallery** page (the first tab, "Image library"). It is also what every "choose an existing image" button opens (pages, announcements, directory photos, lesson pictures).

## What is in it

| Where it came from (`origin`) | What it is | Count when built |
|---|---|---|
| `uploaded` | A file in our Supabase `images` bucket, put there by an admin | 199 (159 were registered before; 40 older uploads from before tracking existed were found in the bucket and added) |
| `site` | A file that ships with the site (the lesson paintings, the Makeup Work banners and mountain art, the default share image, the built-in logo). A copy is kept in the bucket under `site/`; `source_url` keeps its original path | 22 |
| `linked` | Only an address on another website. Not copied. The Church's own picture for each talk, and YouTube's picture for each video lesson | 114 (97 Church, 17 YouTube) |

335 images in all (it was 159). Each has a title, description, alt text, tags, credit, a permission/licence note, where it came from, its size, its dimensions and when it was added.

## Finding things

The search box matches the **start of any word**, in the title, tags, description, alt text, credit and licence. All words must match. Titles and tags rank above descriptions. You can also narrow by one tag, by where it came from, and by where it is used (any part of the site, "used somewhere", or "not used anywhere" to find leftovers).

It is a real database search (`search_media_library()`, a full-text index on a `search` column that is rebuilt on every save), paged 48 at a time, so it stays quick as the library grows.

## Where a picture is used is never stored

`media_library_usage` is a view that works it out from the real content every time it is read: pages (social image and every picture in their blocks), announcements (cover and blocks), events, directory photos, photo albums, lesson pictures (including YouTube's automatic picture for a video lesson) and the site header and footer. It counts a place once however often the picture appears there. A site image is recognised by either its copy's address or its original path, so a lesson that still says `/makeup/thumbs/x.webp` counts as using the copy.

Because nothing is stored, it can never go stale. It is also what makes deleting safe.

## Safety rules (enforced in code and in the database)

- **A picture that anything uses cannot be deleted.** The check is made again at the moment of deleting. Replacing one asks first, and names where it is used.
- **Replacing a picture puts the new one at the same address**, so every place that uses it changes. Only for hosted `.webp` pictures (everything uploaded through the admin). A browser that already loaded the old one may keep it for up to an hour.
- **A picture's address and where it came from cannot be changed** by an admin (a database trigger refuses). Only its description can.
- Text is limited (title 200, description 1000, alt text 300, credit 300, licence 300; at most 20 tags of 40 characters), tidied (tags lower-cased, no repeats, alphabetical) by the database whatever sends it.
- **Admins only.** The public gets nothing: no table, view or function is open to anonymous visitors. The public site never reads the library; it reads the addresses straight from the content.

## How uploads get registered

Two layers, so nothing is missed:

1. A **database trigger on the storage bucket** registers any file that lands in `images` (whoever uploaded it, by any route). It can never stop an upload: if it fails, the upload still succeeds. Removing a hosted file from storage also removes its entry (a link is never removed this way).
2. The **admin's upload code** (`src/admin-app/imageUpload.js`, which every upload goes through) then fills in the details (size, dimensions, a default title and tags from where it was put, alt text when the block had one). It waits for this, so a picture is findable the moment its upload finishes, and a problem here never fails the upload.

A picture that only lives on another website is registered when a lesson is saved with it (`registerLessonPicture`).

## Defaults chosen

- The library is the first, default tab of the Gallery page. The old "Albums" and "All site images" views are still there as "Photo albums" and "Where images are used".
- Linked pictures are credited to the Church or to YouTube, with "Linked from ..., not copied." as the permission note, and are never bulk-copied.
- Titles were derived from the content that uses each picture ("Photo of Maya", "Cover image for ...", "Image on the page ..."), and tags from where in storage it was put. Admins can improve them.
- A picture chosen from the gallery for a lesson that is one of the lesson paintings is stored as its original site path (`/makeup/thumbs/x.webp`), which is how lessons have always named it, so it is shown as a painting with its credit.

## Backfill (done once, kept as the record)

- `supabase/migrations/0047_image_library.sql`: the columns, the search index, the usage view, the triggers, the policies, and a derived backfill (older bucket files, the Church and YouTube pictures, titles and tags). It only fills blanks, so it is safe to run again.
- `scripts/gallery-backfill/`: a temporary token-protected edge function that copied the site's own images into the bucket (read from the live site, nothing passed through any chat) and read every hosted image's dimensions from the file itself. Already run and replaced by a stub that answers 410. `make-manifest.mjs` regenerates the list of site images (with credits) from the same data the site uses (`src/makeup/thumbnails.js`, `art.js`).

## Moving to another Supabase project

- The database trigger needs to know where public files live: **update the one row in `media_config`** (`public_base_url`, for example `https://<project>.supabase.co/storage/v1/object/public/images/`). If it is empty, the trigger simply does nothing and the admin's upload code still registers everything.
- Triggers on Supabase's own `storage.objects` table are not part of a dump of the `public` schema. Re-run the two `create trigger ... on storage.objects` statements from migration 0047 on the new project.
- Content stores full addresses (`https://<old project>.supabase.co/storage/v1/object/public/images/...`). Every hosted image has its `storage_path` recorded, and `media_library_usage` lists every place that uses each one, so rewriting the addresses is a find-and-replace on the old project address, and this library is the checklist to verify afterwards.
