import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// supabase-js is loaded as a UMD bundle from the CDN in index.html.
// eslint-disable-next-line no-undef
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session; // null if not logged in
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}
