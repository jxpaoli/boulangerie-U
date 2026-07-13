import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase — configuré sur le schéma isolé `point_chaud`
 * (base partagée multi-appli). Clé PUBLIQUE (anon) uniquement.
 *
 * Tant que les variables d'env ne sont pas remplies (`.env.local`), le client
 * est `null` et l'appli tourne sur la couche mock (VITE_DATA_SOURCE=mock).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const SUPABASE_SCHEMA = 'point_chaud'

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        db: { schema: SUPABASE_SCHEMA },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null

/** Source de données effective : 'supabase' si branché, sinon 'mock'. */
export const dataSource: 'supabase' | 'mock' =
  supabase && import.meta.env.VITE_DATA_SOURCE !== 'mock' ? 'supabase' : 'mock'
