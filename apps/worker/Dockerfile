# Worker — webhooks Meta + files d'attente. Processus permanent : il ne
# tourne pas sur Netlify (fonctions courtes), voir CLAUDE.md.
#
# Contexte de build : la RACINE du dépôt (les packages partagés en font partie).
#   docker build -f apps/worker/Dockerfile .
#
# Image Playwright : Amadou lit les annonces dans un vrai Chromium, qui
# demande ses bibliothèques système. La version doit suivre celle du paquet
# `playwright` du worker, sinon les navigateurs embarqués ne correspondent pas.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

# Les navigateurs sont déjà dans l'image (/ms-playwright).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN corepack enable

COPY . .

# NODE_ENV n'est pas encore à `production` ici : pnpm sauterait les
# devDependencies des packages partagés.
RUN pnpm install --frozen-lockfile --filter "@codaya/worker..."

ENV NODE_ENV=production
WORKDIR /app/apps/worker

# Les packages internes sont importés en TypeScript : `node dist/` ne sait
# pas les charger, d'où tsx.
CMD ["pnpm", "start"]
