import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Config } from 'drizzle-kit'

// pnpm --filter exécute ce fichier depuis packages/db : le .env de la
// racine du monorepo n'est pas chargé automatiquement, il faut le pointer.
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') })

export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  // Les migrations passent par la connexion directe, pas par le pooler.
  dbCredentials: { url: process.env.DIRECT_URL! },
} satisfies Config
