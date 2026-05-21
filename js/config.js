// Safe for the browser — these are public-facing values only.
export const SUPABASE_URL = 'https://uhkrspeeqdjjbzveibir.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoa3JzcGVlcWRqamJ6dmVpYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNTIzMzAsImV4cCI6MjA5NDkyODMzMH0.J7yzqKc5h_dIAZE4vlRVzxz8V8VD8gCMAnIeYRyMiD0';

// In development the API runs locally.
// In production, Vercel rewrites /api/* and /invitations/* to the backend,
// so the base URL is empty (relative paths resolve to the same origin).
export const API_BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8001'
    : '';
