// Used ONLY inside the client-side admin app (and the public contact form island).
// Anon key + the logged-in admin's session JWT — RLS enforces what an authenticated
// user can actually read/write, this client has no elevated privileges of its own.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabaseBrowser = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
