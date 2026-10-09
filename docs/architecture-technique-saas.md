# Architecture technique — SaaS multi-tenant

*Version de travail du 2026-09-21, complétée le 2026-09-23 (les liens : décision de n'en mettre aucun dans les templates), le 2026-09-24 (coût d'API recalculé sur la grille de prix révisée) et le 2026-09-25 (palier Premium et vitrine retirés : deux plans seulement, aucun bouton d'URL ; bibliothèque de templates convertie aux boutons de réponse rapide ; intégration calendrier abandonnée au profit d'un simple lien de prise de rendez-vous). Pendant technique de `claude/architecture-produit-differenciation.md`, qui reste à verser dans ce projet.*

## Convention de nommage — la base de code en anglais

**Règle : tout le code s'écrit en anglais. Le français est réservé à ce que voit l'utilisateur final.**

En anglais : noms de fonctions, de variables et de fichiers, tables et colonnes, endpoints, branches Git, messages de commit, et **les noms et descriptions des tools et skills exposés au modèle**.

En français : libellés du dashboard, contenu des messages envoyés aux particuliers, documentation destinée aux clients.

### Pourquoi ça compte pour les tools de l'IA, au-delà de la convention

Ce n'est pas qu'une question de style sur cette partie précise :

- Les modèles sont massivement entraînés sur du code et de la documentation technique en anglais. Des noms d'outils et des descriptions en anglais donnent une **sélection d'outil plus fiable** que `rechercher_biens` avec une description en français.
- Ça élimine les accents et caractères non-ASCII dans les identifiants (`créer_rdv` → `book_appointment`), qui provoquent des ennuis de sérialisation et de schéma JSON.
- Ça maintient une séparation nette : le modèle raisonne en anglais sur la mécanique et répond en français à l'utilisateur, ce qui se pilote proprement depuis le prompt système.

### Cas particulier des templates WhatsApp

Par cohérence, les **noms de templates** (`lead_followup_no_reply`) et leurs **variables** suivent la même règle, même si leur contenu reste en français. C'est possible nativement : Meta accepte des **paramètres nommés** en plus des positionnels `{{1}}`. On déclare `"parameter_format": "named"` à la création, les noms devant être en minuscules avec underscores — `{{first_name}}`, `{{property_name}}`. Un template ne peut pas mélanger nommé et positionnel.

On prend systématiquement le nommé : les valeurs peuvent alors être envoyées dans n'importe quel ordre, et un template relu six mois plus tard reste lisible — ce qui n'est jamais le cas avec `{{1}}`, `{{2}}`, `{{3}}`.

## Décision : la clé API Anthropic reste celle de Codaya

Le réflexe « chaque client apporte sa clé » a été écarté, chiffres à l'appui.

Claude Haiku 4.5 coûte 1 $/million de tokens en entrée et 5 $ en sortie. Une conversation de qualification complète revient à **0,04–0,05 $, soit environ 25–30 FCFA** — et nettement moins avec le prompt caching, une lecture de cache ne coûtant que 10 % du prix d'entrée. Une agence à 300 conversations par mois représente donc **~9 000 FCFA d'API**. Rapporté à la grille du 25 septembre 2026 (voir `modele-economique.md`), c'est **environ 6 % de l'Essentiel à 150 000 FCFA** et 4,5 % du Complet à 200 000.

**Non chiffré à ce jour :** les frais Meta sur les templates envoyés hors fenêtre de 24 h (relances, rappels de visite, notamment les templates marketing). Ils s'ajoutent au coût variable et conditionnent le seuil de la limite d'usage.

Transférer une ligne de coût de cet ordre au client coûterait : l'ouverture d'un compte Anthropic avec une carte en dollars (obstacle réel à Dakar, qui retarde ou tue une vente déjà signée), une panne le samedi quand son crédit s'épuise sans aucune visibilité de notre côté, l'impossibilité d'optimiser (cache partagé, routage vers un modèle moins cher pour les tâches simples, batch à −50 %), et zéro effet de volume.

**Décision : Codaya détient la clé, facture un abonnement avec une limite d'usage raisonnable et un palier au-delà.** Exception possible, sur devis et hors grille, pour un gros client qui exigerait la maîtrise de ses coûts ou de ses données. Elle n'est rattachée à aucun plan.

## Le principe central : il n'y a pas « un agent » et « un dashboard »

L'agent WhatsApp n'est pas un programme à connecter au dashboard. **C'est un mode d'entrée/sortie du même backend.** Les deux lisent et écrivent la même base — il n'y a aucune synchronisation à construire.

### Flux complet

1. Un acheteur écrit sur le numéro de l'agence.
2. Meta appelle **un webhook unique, commun à tous les tenants**.
3. Le payload contient le `phone_number_id` et le `waba_id` : **c'est la clé de tenant**. C'est là, et nulle part ailleurs, que se fait la « liaison ».
4. Vérification de la signature `X-Hub-Signature-256`, mise en file de l'événement, **réponse 200 immédiate**. Jamais d'appel LLM dans le webhook : Meta retente puis désactive le webhook si la réponse est lente ou en erreur.
5. Un worker dépile, charge le contexte du tenant (catalogue, ton, règles), appelle Claude en tool use, écrit en base.
6. Le worker répond via `POST /{phone_number_id}/messages` avec le token du tenant.
7. Le dashboard lit la même base.

### Branchement d'un nouveau client : Embedded Signup

Mécanisme officiel de Meta pour les Tech Providers. Le client clique un bouton dans le dashboard, s'authentifie avec son compte Meta, accepte les conditions, crée ou sélectionne son WABA et enregistre son numéro. En sortie, on récupère le **WABA ID**, le **phone number ID** et un **code échangeable contre un business token**. Aucun identifiant client ne transite par nous.

Deux prérequis à lancer bien avant le premier client : **l'App Review est obligatoire** (aucun onboarding possible sans accès avancé approuvé), et la **vérification commerciale** fait passer la limite de 10 à 200 onboardings par tranche de 7 jours.

## Stack

| Couche | Choix | Raison |
|---|---|---|
| Dashboard | Next.js (App Router), multi-tenant | Stack maîtrisée, rendu soigné |
| Backend applicatif | Node / TypeScript | Idem |
| Webhooks + workers | **Service séparé**, hors Next.js | Ne pas faire dépendre des boucles d'agent de timeouts serverless |
| File d'attente | pg-boss ou Graphile Worker (Postgres) | Zéro infra supplémentaire ; Inngest si on préfère du managé |
| Base de données | PostgreSQL (Neon ou Supabase) | Multi-tenant partagé, `tenant_id` partout, RLS — surtout pas une base par client |
| Stockage médias | R2 ou S3 | Les media IDs Meta expirent : les photos du régisseur doivent être rapatriées |
| Auth dashboard | Auth.js / Clerk / Supabase Auth | Multi-utilisateur par agence, rôles `owner` / `agent` |
| Secrets | Tokens Meta par tenant chiffrés au repos | — |

Pas de brique d'hébergement de sites : la vitrine a été retirée du périmètre le 2026-09-25.

**Pas de brique calendrier non plus.** Une intégration à l'agenda de l'agence — Google Calendar ou Calendly, lecture des disponibilités et écriture de l'événement — a été conçue puis **abandonnée le 2026-09-25** : OAuth par tenant, deux intégrations à maintenir, des jetons qui expirent, pour une hypothèse non vérifiée sur l'équipement des agences. À la place, Coumba envoie le **lien de prise de rendez-vous** que l'agence a déjà, ou annonce un rappel. Voir §10 de `claude/specifications-fonctionnelles.md`. La piste par API reste ouverte si des agences la réclament.

## Modèle de données

`tenants` — agence, `plan` (`essential` / `complete`, voir `modele-economique.md` ; `complete` active le profil `property_manager`), feature flags, **`listing_domains[]`** (les domaines publics de l'agence — au pluriel : site principal et sous-domaine d'annonces), **`booking_url_rental`**, **`booking_url_sale`** et **`split_booking_links`** (§10)
`whatsapp_accounts` — `waba_id`, `phone_number_id`, token chiffré, `tenant_id`
`message_templates` — templates poussés sur le WABA du tenant, avec leur statut d'approbation
`contacts` — le particulier (acheteur ou locataire)
`conversations` / `messages`
`leads` — statut, qualification, score
`properties` — le catalogue, `tenant_id`, avec `status` (publié / dépublié), `availability` + `available_from`, **`listing_url`** et `source_url`
`visit_requests` — la demande de visite et ce qu'on en a fait (`link_sent` / `callback_announced`), jamais un rendez-vous : nous n'en connaissons ni la date ni l'existence
`tickets` + `ticket_media` — côté régisseur
`sourced_prospects` — **pool global, sans `tenant_id`** : il appartient à Codaya
`prospect_matches` — `(prospect_id, tenant_id, status)` : l'attribution d'un prospect sourcé à une agence

Cette dernière paire de tables est ce qui rendra l'ajout de Sokhna trivial le jour où elle existera : **l'onglet « prospects » est un feature flag qui lit `prospect_matches`. L'activer, c'est changer une ligne, pas déployer quoi que ce soit.** Elle n'est rattachée à aucun plan tant que la prospectrice n'est pas livrée.

## Les agents

**Un seul runtime, plusieurs profils.** Le régisseur n'est pas une seconde application : c'est le même moteur avec un autre jeu de prompts et d'outils. Le routage se fait sur l'identité du contact — locataire connu en base → profil `property_manager` ; inconnu → profil `sales`. Le profil `property_manager` n'est actif que si le tenant est en plan `complete`.

**Ce que chaque profil a le droit de dire est au §9 de `claude/specifications-fonctionnelles.md`** — trois zones, engagements interdits, escalade. Le prompt système de chaque profil se dérive de ce §9, jamais l'inverse.

Outils exposés au modèle (tool use) :

- `search_properties(criteria)` — **ne renvoie que les biens `status = published`**. Un bien dépublié n'existe pas pour Coumba
- `get_property(id)` — renvoie `listing_url` s'il existe, jamais une URL reconstruite ou devinée
- `save_qualification(lead_id, data)`
- `offer_visit(lead_id, intent)` — renvoie `{ mode: 'link', url }` ou `{ mode: 'callback' }` selon la configuration du tenant, et enregistre la demande. **Le modèle ne construit jamais l'URL**, il reçoit celle qui est configurée ou rien
- `open_ticket(contact_id, data)` — profil régisseur
- `escalate_to_human(reason)` — notifie le dashboard
- `fetch_listing(url)` — profil catalogue (Amadou), lecture d'une annonce de l'agence pour pré-remplir une fiche

## La règle des 24 heures et les templates

**Principe.** Quand un particulier écrit, une fenêtre de **24 heures** s'ouvre : pendant ce temps l'agent répond en texte libre généré par le modèle, autant qu'il veut, et ces messages de service sont **gratuits** depuis juillet 2025. Chaque message entrant réarme la fenêtre.

**Hors fenêtre, le texte libre est bloqué.** Seuls passent les **templates pré-approuvés** par Meta.

**Conséquence produit, à ne pas perdre de vue :** hors fenêtre, l'agent ne rédige rien. Il choisit un template approuvé et remplit ses variables. L'intelligence porte sur *quel* template et *quand*, pas sur la formulation. On vend donc « relances automatiques », jamais « relances rédigées par l'IA ».

Logique métier : `si (now - last_inbound_message) < 24h → texte libre ; sinon → template approuvé + variables`.

**Conséquence onboarding.** Les templates appartiennent au WABA de chaque client : chaque agence a besoin de **sa propre bibliothèque approuvée**. À automatiser en fin d'Embedded Signup — le backend pousse la série standard par API sur le WABA du client et suit les approbations (de quelques minutes à 24 h). Sans ça, on découvre au troisième jour que le produit est installé mais ne peut relancer personne.

### Les liens : la contrainte, et la façon de ne pas la subir

Question posée le 2026-09-23, et la réponse n'est pas celle qu'on attend.

**Il n'y a pas d'interdiction de mettre un lien dans un message.** Ni la politique commerciale WhatsApp ni la documentation d'application des règles ne restreignent les URL, les domaines ou les raccourcisseurs. **Dans la fenêtre de 24 h, on envoie ce qu'on veut** : texte libre, autant de messages qu'on veut, n'importe quel lien, n'importe quel domaine — et c'est gratuit depuis juillet 2025.

**La contrainte est hors fenêtre, et elle est structurelle.** Une URL écrite dans le corps d'un template est figée à l'approbation. Pour une adresse qui change d'un bien à l'autre, il faut un **bouton d'URL dynamique**, et la variable n'y est pas l'URL entière : c'est seulement **la fin d'une adresse de base fixe approuvée avec le template**.

```
https://{{listing_domain}}/biens/{{slug}}      ✗  le domaine ne peut pas être variable
https://residences-atlantique.sn/biens/{{1}}   ✓  base fixe, suffixe variable
```

**En multi-tenant, ça voudrait dire un template par domaine de client**, à réapprouver chaque fois qu'une agence change de site. Coûteux, fragile, et bloquant à l'onboarding.

#### La décision : aucun template ne porte de lien

**Les templates ne servent qu'à rouvrir la fenêtre. Les liens partent ensuite en message libre.**

> *« Bonjour {{first_name}}, je n'ai pas eu votre retour. J'ai plusieurs biens qui correspondent à ce que vous cherchez. Je vous les envoie ? »*
> `[ Oui, envoyez ]` `[ Non merci ]`

Le prospect touche un bouton → c'est un message entrant → la fenêtre de 24 h s'ouvre → Coumba envoie les fiches, les liens, les photos, ce qu'elle veut, sur le domaine qu'elle veut.

**Ce que ça règle, et c'est considérable :**

- **Le domaine disparaît du problème.** Plus aucune adresse dans les templates, donc plus rien à faire varier par tenant.
- **Une seule bibliothèque canonique.** Les templates appartiennent toujours au WABA de chaque client — on pousse donc toujours N fois — mais **le contenu est strictement identique**. C'est la différence entre maintenir N bibliothèques et pousser une bibliothèque N fois. Un seul fichier de définition, un seul jeu d'approbations à suivre.
- **Plus de question bloquante à l'onboarding.** L'agence peut n'avoir aucun site le jour de l'installation ; le produit marche quand même.
- **Un client qui change de site n'a aucun template à refaire.**

C'est aussi ce qui a rendu la vitrine superflue : puisque n'importe quel domaine passe en message libre, Coumba envoie le lien de l'annonce là où l'agence la publie déjà — son site ou une plateforme.

#### Boutons de réponse rapide, jamais « répondez OUI »

Un template accepte des **quick reply buttons** : du texte statique, aucune variable, aucun domaine, approuvés sans difficulté. Toujours les préférer à une consigne écrite :

- **Meilleur taux de réponse** — un doigt sur un bouton contre une saisie au clavier.
- **Réponse structurée** — le webhook renvoie un payload, pas du texte à interpréter. On n'a pas à deviner si « ok », « ouii », « pourquoi pas » veut dire oui.
- **Le tap est un message entrant**, au même titre qu'un texte, une image ou une réponse de liste : il ouvre la fenêtre.

**Limites de format.** Corps du template : 1 024 caractères, valeurs des variables comprises. Boutons de réponse rapide : jusqu'à 10 par template d'après la documentation Meta actuelle, **25 caractères par libellé** — mais des guides tiers citent encore 20, et l'éditeur du fournisseur peut être plus strict. **On reste sous 20 caractères**, ce qui est de toute façon préférable à l'affichage sur un téléphone.

#### Le prix à payer, à connaître

Une relance de ce type — « j'ai des biens qui peuvent vous intéresser » — est **marketing**, pas `utility`. Trois conséquences, dont une bonne :

- **Plus cher** que l'utility.
- **Limites par utilisateur.** Meta plafonne les templates marketing par destinataire, selon son taux de lecture récent et l'encombrement de sa boîte. Dépassement → erreur `131049`, attendre 24 h ; insister dans les 24 h peut suspendre la distribution vers ce contact. **Mais dès que l'utilisateur répond, la fenêtre de 24 h s'ouvre et les messages marketing envoyés dans cette fenêtre ne comptent plus dans la limite.** Autrement dit, Meta récompense exactement le schéma retenu : un template qui provoque une réponse.
- **Géographie, et c'est une bonne nouvelle pour l'angle diaspora.** Les templates marketing **ne sont pas distribués aux numéros américains**. Et l'EEE, le Royaume-Uni, le Japon et la Corée du Sud sont **hors du champ des limites par utilisateur** — la diaspora en France et en Europe, cœur de cible, n'est donc pas plafonnée.

#### Aucun bouton d'URL, sans exception

Le schéma coûte un aller-retour. Sur un moment à forte intention où l'adresse est déjà connue — une confirmation de visite, par exemple — un bouton d'URL économiserait ce round-trip.

**Décision : aucun bouton d'URL dans la bibliothèque, pour aucun client.** L'option existait comme avantage du palier Premium, pour les agences dont la vitrine aurait été hébergée sous leur propre domaine. Premium et vitrine ont été retirés le 2026-09-25 : l'option disparaît avec eux, et la bibliothèque reste strictement identique pour tous les tenants.

#### Hygiène de lien, indépendante de l'autorisation

Rien n'interdit un lien, mais un lien que le destinataire ne reconnaît pas augmente les signalements et les blocages, qui font baisser la note de qualité du numéro et finissent par plafonner le volume d'envoi. Deux règles : **jamais de raccourcisseur** — l'adresse affichée doit montrer le domaine — et **un lien seulement quand le client l'a demandé**, jamais en ouverture.

Une information utile à l'agence, distincte du technique : une annonce hébergée sur une place de marché affiche aussi celles des concurrents. Quand l'agence a aussi la fiche sur son propre site, elle peut préférer envoyer ce lien-là. Cet argument servait à vendre la vitrine ; elle a été retirée, mais l'information reste affichée dans le catalogue parce qu'elle aide l'agence à choisir le lien qu'elle envoie.

**Mais il ne se déduit pas d'un domaine inconnu.** Le dashboard ne signale que les sites d'une **liste de référence de places de marché tenue par Codaya, par pays** (`marketplace_domains`, données Codaya et non par tenant). Un domaine hors liste — un PDF sur Drive, une visite en vidéo, la page Facebook de l'agence — ne reçoit aucun commentaire. Voir le §8 de `claude/specifications-fonctionnelles.md` pour les quatre états et l'erreur qui a mené à cette règle.

### Bibliothèque de templates standard

Huit templates, identiques pour tous les tenants. Aucun ne porte de lien, aucun ne demande d'écrire un mot-clé : tous se terminent par des **boutons de réponse rapide**.

| Nom du template | Catégorie | Corps | Boutons |
|---|---|---|---|
| `lead_followup_no_reply` | **marketing** | Bonjour {{first_name}}, nous n'avons pas eu votre retour concernant {{property_name}}. Souhaitez-vous programmer une visite ? | Oui, une visite · Plus tard · Ne plus me contacter |
| `lead_reengage` | **marketing** | Bonjour {{first_name}}, je n'ai pas eu votre retour. J'ai plusieurs biens qui correspondent à ce que vous cherchez. Je vous les envoie ? | Oui, envoyez · Plus tard · Ne plus me contacter |
| `new_listing_match` | **marketing** | Bonjour {{first_name}}, un nouveau bien correspond à votre recherche : {{property_name}}, {{property_price}}. Je vous envoie la fiche ? | Oui, envoyez · Non merci · Ne plus me contacter |
| `visit_slot` | utility | Bonjour {{first_name}}, souhaitez-vous programmer une visite de {{property_name}} ? | Oui, programmer · Plus tard |
| `visit_slot_followup` | utility | Bonjour {{first_name}}, nous n'avons pas eu votre retour concernant la visite de {{property_name}}. Souhaitez-vous toujours la programmer ? | Oui, programmer · Plus tard |
| `ticket_received` | utility | Bonjour {{first_name}}, votre demande concernant {{issue_summary}} est enregistrée sous le numéro {{ticket_number}}. L'agence revient vers vous dès qu'un créneau d'intervention est fixé. | Ajouter un détail · Autre problème |
| `ticket_status_update` | utility | Bonjour {{first_name}}, votre dossier {{ticket_number}} ({{issue_summary}}) est passé au statut : {{ticket_status}}. | En savoir plus · Ce n'est pas réglé |
| `handover` | utility | Bonjour {{first_name}}, un conseiller de {{agency_name}} va vous contacter personnellement au sujet de {{subject}}. | J'attends l'appel · Rappeler plus tard |

**Quatre règles d'écriture.**

**Une question fermée et des boutons, jamais une consigne écrite.** Dès que le particulier touche un bouton, la fenêtre de 24 h se rouvre et l'agent redevient libre de converser. **Le template sert à rallumer la conversation, pas à la mener.**

**Aucun template ne porte de lien** — voir ci-dessus.

**Toute relance marketing porte un bouton de retrait** (« Ne plus me contacter »), qui coupe les relances sur ce contact : c'est l'opposition au sens de l'article 21 du RGPD, et c'est ce qui protège la note de qualité du numéro. Les trois templates marketing le portent, sans exception.

**Aucun bouton ne fait dire à un template ce que l'agent n'a pas le droit de dire** (§9 des spécifications). C'est pour ça que `ticket_received` **n'annonce aucun délai** : l'ancienne rédaction contenait un `{{response_delay}}`, qui contredisait la règle « Malick constate, il n'engage rien ». C'est aussi pour ça que ni `appointment_confirmation` ni `appointment_reminder` ne portent de bouton d'acquiescement : le rendez-vous est déjà confirmé par l'agence, et un bouton « c'est noté » n'apporterait rien qu'un silence n'apporte déjà.

**La catégorie se déclare honnêtement.** Une relance commerciale déguisée en `utility` est requalifiée en `marketing` par Meta, qui est plus cher. C'est pourquoi `lead_followup_no_reply` est passé en `marketing` le 2026-09-25 : relancer un prospect qui n'a pas répondu est une sollicitation commerciale, quel que soit le ton. Motifs de rejet fréquents : contenu trompeur, demande d'informations sensibles, format imitant un message système, violation des politiques commerciales.

**Deux templates retirés le 2026-09-25.** `appointment_confirmation` et `appointment_reminder` n'ont plus de source : sans lecture d'agenda, nous ne connaissons ni la date ni l'heure d'un rendez-vous. Les envoyer supposerait une saisie manuelle par l'agence, et l'outil de réservation qu'elle utilise envoie déjà ses propres confirmations et rappels — en dupliquer serait au mieux redondant, au pire contradictoire. Dans le même mouvement, `visit_slot` ne propose plus de créneau : il demande si le prospect veut programmer une visite, et **le lien de prise de rendez-vous part ensuite en message libre**, la fenêtre étant rouverte par le tap.

## Les trois pièges d'un premier déploiement

**Le numéro.** Un numéro ne peut pas être actif à la fois sur l'app WhatsApp Business et sur la Cloud API : si l'agence bascule son numéro principal, elle perd l'app sur le téléphone. Pour une équipe qui vit dedans, c'est un choc. Au démarrage, faire prendre un **numéro dédié** à l'agent.

**Les templates.** Voir ci-dessus — à faire approuver tôt, certains se font refuser. Comme aucun n'embarque de lien, la bibliothèque est identique pour tous les tenants : on la pousse telle quelle sur chaque WABA, sans rien demander à l'agence au préalable.

**Le catalogue.** La vraie difficulté pratique, systématiquement sous-estimée : sans catalogue à jour, l'agent commercial ne vaut rien. Import Excel/CSV, saisie dans le dashboard et lecture d'annonce par Amadou dès la v1. À traiter comme une fonctionnalité de premier plan, pas comme une étape d'onboarding. Et chaque fiche doit porter son `listing_url` : un bien publié sans lien est un bien que Coumba peut décrire mais pas envoyer. C'est aussi ce que paie la mise en service facturée à l'installation.

## Sources
- [Embedded Signup — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- [Template fundamentals (paramètres nommés, `parameter_format`) — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- [WhatsApp Business Platform policy and spam enforcement — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/policy-enforcement)
- [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/)
- [Boutons à URL dynamique : la variable est un suffixe de l'URL de base — SprintHub](https://docs.sprinthub.com/en/topics/relate/message-templates-meta/message-templates-whatsapp-api/message-templates-how-to-use-buttons-with-dynamic-urls.md)
- [Per-user marketing template message limits — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits)
- [Fenêtre de service de 24 h : ce qui l'ouvre, dont le tap sur un bouton — Ominiflow](https://ominiflow.com/blog/whatsapp-24-hour-session-window)
- [Limites de caractères des templates et des boutons de réponse rapide — Wati](https://www.wati.io/en/blog/whatsapp-template-message-character-limit/)
- [Freebusy: query — Google Calendar API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query) *(piste abandonnée, conservée pour plus tard)*
- [View event type and user calendar availability data — Calendly](https://developer.calendly.com/docs/api-guides/view-event-type-and-user-calendar-availability-data) *(idem)*
- [Pricing on the WhatsApp Business Platform — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [Tarifs de l'API Claude — Anthropic](https://platform.claude.com/docs/en/about-claude/pricing)
