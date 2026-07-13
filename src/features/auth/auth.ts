/**
 * Authentification — connexion par service (une personne active à la fois).
 * Deux implémentations : mock (démo) et supabase (réel). Voir AuthProvider.
 */
import { supabase, dataSource } from '@/lib/supabase'
import type { Role } from '@/features/demo/role'

export interface AuthUser {
  id: string
  name: string
  role: Role
}

export interface AuthAPI {
  current(): Promise<AuthUser | null>
  signIn(email: string, password: string): Promise<AuthUser>
  signOut(): Promise<void>
}

/* --------------------------------- mock ---------------------------------- */

export const DEMO_USERS: { name: string; role: Role; email: string }[] = [
  { name: 'Sabrina', role: 'responsable', email: 'sabrina@demo' },
  { name: 'Léa', role: 'vendeuse', email: 'lea@demo' },
]

// démo : connectée par défaut en responsable (évite l'écran de login à chaque ouverture)
let mockCurrent: AuthUser | null = { id: 'u-sabrina', name: 'Sabrina', role: 'responsable' }

const mockAuth: AuthAPI = {
  async current() {
    return mockCurrent
  },
  async signIn(email) {
    const u = DEMO_USERS.find((x) => x.email === email.trim().toLowerCase()) ?? DEMO_USERS[0]!
    mockCurrent = { id: `u-${u.name.toLowerCase()}`, name: u.name, role: u.role }
    return mockCurrent
  },
  async signOut() {
    mockCurrent = null
  },
}

/* ------------------------------- supabase -------------------------------- */

async function profileOf(userId: string): Promise<AuthUser | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', userId)
    .maybeSingle()
  if (!data) return null
  return { id: userId, name: data.display_name as string, role: data.role as Role }
}

const supabaseAuth: AuthAPI = {
  async current() {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    const uid = data.session?.user.id
    return uid ? profileOf(uid) : null
  },
  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase non configuré')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const profile = await profileOf(data.user.id)
    if (!profile) throw new Error("Ce compte n'a pas accès au Point Chaud.")
    return profile
  },
  async signOut() {
    await supabase?.auth.signOut()
  },
}

export const auth: AuthAPI = dataSource === 'supabase' ? supabaseAuth : mockAuth
