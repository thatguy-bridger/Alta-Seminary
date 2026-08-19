// Shared CORS headers for Edge Functions called directly from the browser.
// Restrict to the actual site origin once the domain is known — permissive during setup.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
