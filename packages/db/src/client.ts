import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import postgres from 'postgres'
import * as schema from './schema.js'

// Ce package est consommé depuis apps/dashboard, apps/worker et des scripts —
// chacun avec un cwd différent. On charge donc explicitement le .env de la
// racine du monorepo plutôt que de compter sur le chargement automatique de
// chaque runtime (qui ne regarde que son propre dossier).
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') })

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL manquant — voir .env.example')

/**
 * UN seul client par processus. En développement, Next.js réévalue ce module
 * à chaque rechargement à chaud : sans ce cache sur globalThis, chaque
 * rechargement ouvrait un nouveau pool sans fermer l'ancien — 160 connexions
 * retenues par un seul `next dev`, et le pooler Supabase (200) qui refuse
 * tout, worker compris (EMAXCONN, constaté le 2026-10-05).
 *
 * `idle_timeout` rend au pooler les connexions inactives au lieu de les
 * garder indéfiniment (défaut de postgres-js).
 */
const globalForDb = globalThis as unknown as { codayaSql?: ReturnType<typeof postgres> }
const sql = globalForDb.codayaSql ?? postgres(url, { prepare: false, max: 10, idle_timeout: 20 })
globalForDb.codayaSql = sql
export const db = drizzle(sql, { schema })
export { schema }
