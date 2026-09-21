import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://tmmsfazjravormkwnmji.supabase.co';
export const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_QefytNKxOjA_dW6C0hYeUA_eW4M6XsO';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storageKey: 'cerise.auth.v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  global: {
    fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }),
  },
});

export function loginErrorMessage(error) {
  const prefix = 'Connexion impossible. ';
  if (error?.code === 'invalid_credentials') return prefix + 'Adresse e-mail ou mot de passe incorrect. Utilise le compte Cerise créé dans Authentication > Users, pas les identifiants du tableau de bord Supabase.';
  if (error?.code === 'email_not_confirmed') return prefix + 'Cette adresse e-mail doit être confirmée dans Supabase.';
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') return prefix + 'Trop de tentatives. Patiente quelques minutes avant de réessayer.';
  if (['email_provider_disabled', 'provider_disabled'].includes(error?.code)) return prefix + 'La connexion par e-mail est désactivée dans la configuration Supabase.';
  if (error?.status >= 500) return prefix + 'Le service de connexion rencontre une erreur. Réessaie dans quelques instants.';
  if (['AuthRetryableFetchError', 'TimeoutError', 'AbortError'].includes(error?.name) || error?.status === 0) return prefix + 'Le service de connexion est injoignable. Vérifie le réseau et réessaie.';
  const code = /^[a-z0-9_]{1,64}$/.test(error?.code ?? '') ? error.code : '';
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? `HTTP ${error.status}` : '';
  const diagnostic = [code, status].filter(Boolean).join(' · ');
  return prefix + (diagnostic ? `Le service a refusé la connexion (${diagnostic}).` : 'Une erreur est survenue dans l’application. Recharge la page avant de réessayer.');
}

export function createTransport(owner, client = supabase) {
  const request = async (name, args) => {
    const { data: auth, error: authError } = await client.auth.getSession();
    if (authError) throw authError;
    if (!auth.session || auth.session.user.id !== owner) throw new Error('Compte déconnecté.');
    const { data, error } = await client.rpc(name, args).setHeader('Authorization', `Bearer ${auth.session.access_token}`);
    if (error) throw error;
    return data;
  };
  return {
    read: () => request('cerise_read_journal'),
    save: (revision, state, operation) => request('cerise_save_journal', { expected_revision: revision, operation_id: operation, journal: state }),
  };
}