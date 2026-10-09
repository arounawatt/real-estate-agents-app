# codaya-agents

SaaS multi-tenant : une équipe d'agents IA sur WhatsApp pour une agence
immobilière, et un tableau de bord pour les piloter.

**Lire `CLAUDE.md` avant d'écrire une ligne.** Les règles qu'il contient ont
toutes été arbitrées, chacune pour une raison écrite. `docs/` contient les
documents de référence complets.

## Démarrer

```bash
cp .env.example .env     # puis compléter — chaque variable est commentée
pnpm install
pnpm db:generate && pnpm db:migrate
pnpm dev                 # dashboard sur :3000, worker sur :3001
```

## Scripts

Tous se lancent depuis la racine du projet. Il n'y a qu'**une seule base**,
celle de Supabase : tout ce qui écrit en base écrit dans les vraies données.

**Développement**

| Commande | Ce qu'elle fait |
|---|---|
| `pnpm dev` | Lance le tableau de bord (:3000) et le worker (:3001). |
| `pnpm typecheck` | Vérifie les types de tous les paquets. |
| `pnpm build` | Compile les applications pour la production. |

**Base de données**

| Commande | Ce qu'elle fait |
|---|---|
| `pnpm db:generate` | Écrit une nouvelle migration dans `packages/db/migrations` après un changement de `schema.ts`. N'écrit rien en base. |
| `pnpm db:migrate` | Applique sur Supabase les migrations qui n'y sont pas encore. Sans effet sur celles déjà passées. |
| `pnpm db:seed` | ⚠ Crée une agence de démonstration « Résidences Atlantique » **à chaque lancement**, sans rien supprimer. À ne pas lancer sur la base actuelle. |

**Agences, comptes et WhatsApp** — mode d'emploi détaillé dans `onboarding/LISEZMOI.md`

| Commande | Ce qu'elle fait |
|---|---|
| `pnpm ops:onboard <fichier>.json` | Installe une agence complète depuis `onboarding/<fichier>.json` : agence, numéros admin, WhatsApp. Tout ou rien. |
| `pnpm ops:tenant --phone "+221 …" [--name …] [--plan essential\|complete]` | Crée une agence et son premier compte (mot de passe provisoire affiché). |
| `pnpm ops:user --tenant <id> --phone "+221 …" [--name …] [--no-access]` | Ajoute un numéro à une agence, ou réinitialise son mot de passe et débloque le compte. |
| `pnpm ops:whatsapp --tenant <id> --waba-id <id> --phone-number-id <id>` | Raccorde le numéro WhatsApp d'une agence (jeton vérifié par Meta, demandé au clavier). |
| `pnpm ops:whatsapp-token [--tenant <id>]` | Remplace le jeton Meta d'un numéro déjà raccordé, quand il a expiré (symptôme : Coumba ne répond plus). |

Mots de passe et jetons sont toujours demandés au clavier, jamais en argument.

## Ce qu'il faut obtenir avant le premier client

Délais incompressibles, à lancer très en amont :

| Démarche | Pourquoi | Délai |
|---|---|---|
| Vérification commerciale Meta | Fait passer la limite de 10 à 200 onboardings par 7 jours | plusieurs jours |
| App Review `whatsapp_business_management` et `whatsapp_business_messaging` | **Aucun onboarding client n'est possible sans** | plusieurs jours |
| Numéro WhatsApp dédié | Un numéro ne peut pas être à la fois sur l'app Business et sur la Cloud API | immédiat |
| Déclaration préalable à la CDP (Sénégal) | **Obligatoire AVANT tout traitement.** 500 000 à 100 M FCFA et jusqu'à 7 ans | à instruire |

## Structure

```
apps/dashboard     Next.js App Router
apps/worker        webhooks Meta + files d'attente — service séparé
packages/db        Drizzle : schéma, et TOUTES les requêtes de lecture
packages/whatsapp  Cloud API, bibliothèque de templates, signature
packages/agent     profils, outils, zones de réponse, calcul d'urgence
docs/              spécifications, architecture, maquette de référence
```

## À vérifier en intégration continue

- `validateTemplates()` — aucun lien, aucun mot-clé, boutons sous 20 caractères,
  bouton de retrait sur toute relance marketing.
- Le validateur d'enums sur les données réelles, pas seulement sur le schéma.
- Les conversations pièges du §9, rejouées à chaque changement de prompt.

## Ce qui n'est pas décidé

L'heuristique de score des leads. Elle est volontairement absente : un score
inventé piloterait le tri par défaut et le badge « lead chaud », et ne
survivrait pas à la question « d'où il sort ? ». `listHotLeads()` lève une
erreur explicite plutôt que de renvoyer un classement faux.
