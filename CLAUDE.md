# codaya-agents — consignes de travail

SaaS multi-tenant qui donne à une agence immobilière sénégalaise une équipe d'agents IA sur WhatsApp, plus un tableau de bord pour les piloter. Angle : la diaspora en France et en Europe.

**Les règles ci-dessous ont toutes été arbitrées, chacune pour une raison écrite. `docs/` contient les documents de référence — les lire avant de décider d'un comportement, pas après.**

---

## La règle qui prime sur toutes les autres

**Ne jamais afficher ni affirmer ce qu'on ne sait pas.**

Chaque chiffre, chaque badge, chaque libellé doit correspondre à une donnée qu'on possède réellement. Un indicateur plausible mais invérifiable est pire qu'un indicateur absent : le jour où un patron d'agence demande d'où sort le chiffre et qu'on ne sait pas répondre, toute l'interface devient suspecte.

En pratique, au moment d'écrire la ligne de code : **« d'où sort ce chiffre ? »**. Si la réponse est « on l'estime », il ne s'affiche pas.

Trois indicateurs ont déjà été supprimés après cette question. Voir `docs/specifications-fonctionnelles.md` §1, qui contient l'audit complet de ce qu'on sait et de ce qu'on ne sait pas.

## Langue

**Le code s'écrit en anglais. L'utilisateur final lit du français.**

En anglais : noms de fonctions, de variables et de fichiers, tables et colonnes, endpoints, branches Git, messages de commit, et **les noms et descriptions des outils exposés au modèle** — un outil nommé `search_properties` est choisi plus fiablement qu'un `rechercher_biens`.

En français : libellés du tableau de bord, contenu des messages envoyés aux particuliers, commentaires du code métier.

## Architecture

Monorepo pnpm.

```
apps/dashboard     Next.js App Router, multi-tenant
apps/worker        service séparé : webhooks Meta + files d'attente
packages/db        Drizzle, schéma et requêtes de lecture partagées
packages/whatsapp  client Cloud API, templates, vérification de signature
packages/agent     profils, outils exposés au modèle, zones de réponse
```

**Le worker est un service séparé, hors Next.js.** Une boucle d'agent ne doit pas dépendre d'un timeout serverless.

**Il n'y a pas « un agent » et « un dashboard ».** L'agent WhatsApp est un mode d'entrée-sortie du même backend ; les deux lisent et écrivent la même base. Il n'y a aucune synchronisation à construire.

**Multi-tenant partagé** : `tenant_id` sur chaque table, RLS activé. Surtout pas une base par client.

## Trois contraintes à respecter dès le premier commit

Elles viennent de `docs/agent-assistant-direction.md`, un quatrième agent conçu mais pas construit. Les prendre maintenant ne coûte rien ; les prendre après est un chantier.

**Le routage par identité du contact a trois branches, même si la troisième ne fait rien encore.** Numéro dans `agency_users` → profil `assistant`. Locataire connu → `property_manager`. Inconnu → `sales`.

**Les requêtes de lecture vivent dans `packages/db`, jamais dans les composants Next.js.** « Les dossiers ouverts », « les leads en attente de réponse », « ce qui n'a pas été rappelé » : le tableau de bord et le futur assistant ont besoin exactement des mêmes. Écrites une fois comme fonctions bornées par `tenant_id`, elles servent aux deux.

**De vraies URL de détail : `/leads/:id`, `/tickets/:id`, `/properties/:id`.** Pas de routage en mémoire. Sans URL stable, aucun lien profond n'est possible.

## Le webhook Meta

1. Vérifier `X-Hub-Signature-256` avec `META_APP_SECRET`. Une requête non signée est rejetée.
2. Mettre l'événement en file, **répondre 200 immédiatement**.
3. **Jamais d'appel LLM dans le webhook.** Meta retente puis désactive le webhook si la réponse est lente ou en erreur.
4. Le `phone_number_id` et le `waba_id` du payload sont la clé de tenant. C'est là, et nulle part ailleurs, que se fait la liaison.
5. Les photos : Meta ne donne qu'un `media_id` et l'URL expire. Télécharger le binaire immédiatement et le stocker.

## La règle des 24 heures

Dans la fenêtre : texte libre, autant de messages qu'on veut, n'importe quel lien, n'importe quel domaine. Gratuit.

Hors fenêtre : uniquement des templates pré-approuvés.

```
si (now - last_inbound_message) < 24h  → texte libre
sinon                                  → template approuvé + variables
```

**Aucun template ne porte de lien.** Les templates servent à rouvrir la fenêtre ; les liens partent ensuite en message libre. C'est ce qui permet une bibliothèque strictement identique pour tous les tenants — on la pousse N fois, on n'en maintient qu'une.

**Aucun template ne demande d'écrire un mot-clé.** Tous se terminent par une question fermée avec des **boutons de réponse rapide**, libellés sous 20 caractères. Un tap est un message entrant : il rouvre la fenêtre.

**Toute relance marketing porte un bouton « Ne plus me contacter ».**

## Enums contre texte libre

Deux couches strictement séparées, et c'est la règle qui garde les données exploitables dans six mois.

**Couche contrainte** — `enum` dans le schéma JSON des outils. Elle seule alimente les puces, les filtres, le score et les statistiques. Le modèle ne peut pas produire une valeur hors liste : soit elle y est, soit l'appel est rejeté.

**Couche libre** — un champ `notes`. Ce qui ne rentre dans aucune case. S'affiche dans le détail, **jamais en puce, jamais dans un filtre**.

**« à qualifier » doit être une valeur autorisée de chaque enum.** Sans porte de sortie, le modèle invente une valeur plausible pour satisfaire le schéma, et on se retrouve avec des budgets crédibles et faux.

**Un validateur d'enums tourne en intégration continue sur les données, pas seulement sur le schéma.** Deux valeurs hors liste s'étaient déjà glissées dans les données de démonstration, écrites par celui-là même qui venait de rédiger la règle. Une règle non outillée n'est pas une règle.

## L'urgence est calculée, jamais jugée

Le seul champ du produit où une erreur a des conséquences physiques.

L'agent n'évalue jamais l'urgence. Il établit quatre faits fermés — `habitable`, `utility_cut`, `safety_risk`, `worsening` — et **le code en déduit le niveau**. Le badge porte toujours sa justification : « Urgent · eau coupée », jamais « Urgent » seul.

Le **chemin de sécurité** (gaz, feu, inondation, installation dangereuse, blessé) n'est pas un niveau de plus : consigne de sécurité immédiate, numéros d'urgence configurés par l'agence, escalade sur-le-champ vers un humain.

## Le périmètre de réponse des agents

Le comportement par défaut d'un modèle est de répondre à tout, y compris sur le titre foncier et la fiscalité, avec un aplomb parfait. C'est le risque, pas la solution. Détail complet en `docs/specifications-fonctionnelles.md` §9.

**Zone verte** — le catalogue, les modalités de visite, les coordonnées. Réponse libre adossée aux outils.
**Zone orange** — le quartier : elle situe par des faits stables, jamais de prix, de tendance ni de jugement sur la sécurité ou la réputation.
**Zone rouge** — juridique, fiscal, financier, discriminatoire. Elle ne répond pas, elle escalade.

**Engagements interdits, pour tous les agents, non configurables** : négocier ou annoncer un prix, promettre une disponibilité, valider un dossier, confirmer une visite comme définitive, s'engager sur un délai ou sur qui paie, promettre un rendement.

**Quatre couches, jamais le prompt seul.** Le prompt porte la règle ; `escalate_to_human` en fait une action ; un contrôle sur le message sortant retient tout montant absent du catalogue ; un jeu de conversations pièges est rejoué à chaque changement de prompt.

**En cas de doute, on escalade.** Une escalade inutile coûte une minute ; une escalade manquée coûte un client. C'est le seul endroit du produit où l'on préfère l'excès à la prudence. Et **escalader n'est pas raccrocher** : l'agent continue de répondre en zone verte.

## Prise de rendez-vous

**Aucune intégration d'agenda.** Coumba envoie le lien de prise de rendez-vous que l'agence utilise déjà (`booking_url_rental`, et `booking_url_sale` si `split_booking_links`). S'il n'y en a pas, elle annonce qu'un conseiller rappellera, et elle escalade.

**Le modèle ne construit jamais l'URL** : un outil lit la configuration du tenant et renvoie l'adresse telle quelle, ou rien.

Conséquence assumée : on sait qu'un lien a été envoyé, **pas qu'il a été utilisé**. La table s'appelle `visit_requests`, pas `appointments` — le nom doit dire la vérité.

## Méthode

**Vérifier que chaque patch automatisé a bien été appliqué.** Un remplacement silencieusement raté a déjà cassé toute une page sans qu'aucun script ne s'en plaigne. `assert` avant, vérification du compte après.

**Toute vue passe dans un vrai navigateur avant d'être montrée** : parcours du menu, ouverture des détails, aucune erreur JS, et un passage en 390 px de large.

**Ne jamais réécrire un document de `docs/` depuis une copie locale sans l'avoir relu d'abord.** Ces documents sont édités depuis plusieurs conversations.

## Design

Ivoire chaud en fond, **vert profond** structurant (remplacé par la couleur du tenant en co-branding), **ocre** en accent, **bleu-gris** pour le catalogue. Instrument Serif pour les chiffres et les titres, Inter pour l'interface.

**Contrastes volontairement relevés** : le pastel est illisible sur un téléphone en plein jour à Dakar.

Thèmes clair et sombre définis explicitement, jamais par inversion automatique.

## Ce qui n'est pas décidé

- **L'heuristique de score des leads.** Dans la maquette, c'est un nombre écrit en dur. À laisser en `TODO` explicite plutôt qu'à inventer : elle sera calibrée sur de vraies conversations.
- Le placement commercial de l'assistante de direction.

## Ce qu'on ne fait pas

- Pas de vitrine, pas d'hébergement de sites : retiré du périmètre.
- Pas d'intégration d'agenda : retirée du périmètre.
- Amadou ne lit que les annonces de l'agence cliente, jamais celles d'une autre.
- On ne promet pas Sokhna ni Adja : elles n'existent pas.
