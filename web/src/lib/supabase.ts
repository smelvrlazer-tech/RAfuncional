import { createClient } from '@supabase/supabase-js'

// Só a URL e a anon key (pública por design). A service role key NUNCA entra aqui.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configuracaoAusente = !url || !anonKey

export const supabase = createClient(url || 'http://configuracao-ausente.invalid', anonKey || 'ausente', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
