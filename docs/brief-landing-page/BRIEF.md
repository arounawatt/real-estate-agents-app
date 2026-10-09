# Brief — site public du produit (landing page + pages légales)

*Rédigé le 7 octobre 2026 dans le dépôt `codaya-agents`, à partir des documents de référence (`docs/`) et du code. Destiné à être copié tel quel dans un nouveau projet, avec le dossier `captures/`. Le site n'a pas besoin du code du produit : tout ce qu'il faut savoir est ici.*

---

## 0. À lire avant toute chose

**Tu vas construire le site public d'un produit qui existe et fonctionne.** Une landing page qui donne envie, mobile first, animée avec soin, et les pages légales qu'exige Meta pour publier l'application WhatsApp.

**Trois règles priment sur toutes les autres, y compris sur l'envie de faire beau :**

1. **Ne jamais affirmer ce qu'on ne sait pas.** C'est la règle fondatrice du produit, et elle s'applique au marketing avec encore plus de force. Aucun chiffre inventé, aucun témoignage, aucun logo client, aucun « +50 agences nous font confiance », aucune fonctionnalité qui n'existe pas. Le §4 dresse la liste exacte de ce qu'on peut dire et de ce qu'on ne peut pas dire. **En cas de doute sur une affirmation, ne pas l'écrire, et la signaler.**
2. **Ne rien inventer de ce qui manque.** Nom du produit, entité juridique, adresse, e-mail, prix : tout ce qui n'est pas fourni ici est listé au §12 comme *à fournir*. Mets un emplacement visible `[À FOURNIR : …]`, jamais une valeur plausible.
3. **Mobile first, réellement.** La cible lit sur un téléphone, souvent en plein soleil à Dakar. On conçoit à 390 px de large d'abord, on vérifie à 360 px, puis on élargit.

---

## 1. Le produit en une phrase

**Une équipe d'agents IA qui répond sur WhatsApp au nom d'une agence immobilière, de jour comme de nuit, et un tableau de bord pour la piloter.**

Ce n'est pas « un chatbot ». C'est du personnel, avec des prénoms et des métiers : l'effet recherché chez le client est « j'ai embauché », pas « j'ai installé un robot ». Les chatbots WhatsApp se vendent 20 000 à 60 000 FCFA par mois en Afrique de l'Ouest ; ce produit ne doit jamais être rangé dans cette case — ni par le ton, ni par l'esthétique.

**Le nom du produit n'est pas encore choisi** (voir §12). La société qui l'édite s'appelle **Codaya**. Dans le produit, le tableau de bord porte la mention « par Codaya ».

---

## 2. Pour qui

**Les agences immobilières sénégalaises bien établies** (Dakar et Petite-Côte en premier), et plus particulièrement **celles qui traitent avec la diaspora en France et en Europe.**

**L'argument central, qui tient en une scène :** un acheteur à Paris écrit à 2 h du matin heure de Dakar. Il ne peut pas visiter avant son retour au pays et il engage des sommes importantes. L'agence qui lui répond six heures plus tard l'a perdu ; celle qui répond en quelques secondes le garde. C'est le seul segment où la valeur du produit se démontre en une seule image — **la landing doit être construite autour de cette scène.**

Lecteur type de la page : le dirigeant ou la dirigeante d'une agence, 35–60 ans, sur son téléphone, entre deux rendez-vous. Il connaît son métier par cœur et se méfie des promesses technologiques. Il veut voir, vite, que ça marche et que ça ne le mettra pas dans l'embarras devant ses clients.

---

## 3. Les agents — ce qu'ils font vraiment

| Agent | Métier | Ce qu'il fait (vérifié dans le produit) |
|---|---|---|
| **Coumba** | Chargée de clientèle | Répond aux acheteurs et candidats locataires sur WhatsApp, à toute heure. Cherche dans le catalogue de l'agence, qualifie au fil de la conversation (achat ou location, type de bien, zone, budget, échéance), une question à la fois, sans interrogatoire. Envoie le lien de prise de rendez-vous que l'agence utilise déjà, ou annonce qu'un conseiller rappellera. |
| **Malick** | Régisseur | Reçoit les demandes des locataires en place, photos comprises. Pose quatre questions fermées (logement habitable ? coupure ? risque pour la sécurité ? situation qui s'aggrave ?), ouvre un dossier numéroté, et **l'urgence est calculée à partir de ces faits**, jamais jugée « au feeling » — le badge porte sa justification : « Urgent · eau coupée ». En cas de danger (gaz, feu, inondation, blessé), il donne une consigne de sécurité immédiate et les numéros d'urgence de l'agence, et alerte un humain sur-le-champ. |
| **Amadou** | Agent catalogue | On lui donne l'adresse d'une annonce de l'agence, il la lit et prépare la fiche du bien. **Ce que l'annonce ne dit pas, il le laisse vide plutôt que de l'inventer.** Il ne parle à aucun client. |

**Deux offres** existent dans le produit : *Essentiel* (Coumba + Amadou) et *Complet* (+ Malick, pour les agences qui gèrent des locataires). Le choix se fait sur une seule question : l'agence gère-t-elle des locataires ?

**Les agents se présentent comme automatisés dès leur premier message** (« Coumba, assistante de l'agence — je suis un agent automatisé, un conseiller prend le relais dès que c'est utile »). C'est une obligation, et c'est un argument : l'agence ne trompe pas ses clients.

**Les agents n'ont pas de visage.** Ils sont représentés par un **monogramme dans un anneau coloré** (C vert, M ocre, A bleu-gris — voir les captures). **Aucune photo, aucun portrait généré, aucun avatar humain réaliste** : le produit l'interdit pour que personne n'oublie qu'il écrit à un automate. Cette règle s'applique au site.

---

## 4. Ce qu'on peut dire, ce qu'on ne dit jamais

C'est la section la plus importante du brief. Chaque phrase de la landing doit passer ce filtre.

### Ne jamais écrire

| Interdit | Pourquoi |
|---|---|
| Tout chiffre de résultat : « +40 % de ventes », « réponse en 3 secondes », « 10 000 conversations », « 98 % de satisfaction » | Aucun n'est mesuré. Le produit n'a pas encore de client. |
| Témoignages, citations de clients, logos d'agences, « ils nous font confiance » | Il n'y en a pas. Ne pas créer de section vide « bientôt » non plus. |
| Les prix | Aucun n'a encore été présenté à une agence. Bouton « Demander une démo » à la place. |
| « Elle prend le rendez-vous dans votre agenda », « synchronisé avec Google Agenda / Calendly » | **Il n'y a aucune intégration d'agenda**, c'est un choix. Coumba *envoie le lien* de prise de rendez-vous de l'agence. On sait qu'il a été envoyé, pas qu'il a été utilisé. |
| « Relances rédigées par l'IA » | Hors de la fenêtre de 24 h, WhatsApp n'autorise que des modèles de messages pré-approuvés. On dit **« relances automatiques »**. |
| Sokhna, Adja, ou tout autre agent « bientôt disponible » | Ils n'existent pas. On ne promet pas ce qui n'est pas livré. |
| « Négocie pour vous », « confirme les visites », « valide les dossiers », « répond à toutes les questions » | Ce sont précisément les **engagements interdits** aux agents (voir plus bas). |
| « Remplace vos commerciaux » | Faux et contre-productif : les agents passent la main à l'humain. |
| « Vitrine », « site d'annonces », « hébergement de vos biens » | Retiré du périmètre du produit. |
| « Clients depuis l'Europe » pour un numéro étranger | Le produit sait le pays du **numéro**, pas celui de la personne. |
| Toute mention de sécurité ou de conformité non établie : « certifié », « conforme RGPD », « hébergé au Sénégal », « chiffrement de bout en bout » | Non établi, ou faux. Voir §9 pour ce qui est vrai. |

### Les vrais arguments — tous vérifiés dans le produit

Ce produit a une singularité rare : **ses garde-fous sont son meilleur argument commercial.** Un bon modèle d'IA, laissé à lui-même, répond à tout avec aplomb — y compris sur le titre foncier ou la fiscalité. Ici, non. Le message part au nom de l'agence ; l'agence doit pouvoir dormir tranquille.

- **Une réponse à toute heure**, dans la langue et le registre du client, en texte libre — pas un menu « tapez 1 ».
- **Une qualification sans interrogatoire** : chaque information donnée en passant est retenue, rien n'est redemandé.
- **Ce qu'elle ne fera jamais, par construction** — et non par simple consigne : annoncer ou négocier un prix, promettre une disponibilité, valider un dossier, confirmer une visite comme définitive, s'engager sur un délai ou sur qui paie, promettre un rendement. Ces interdits ne sont configurables par personne.
- **Les sujets sensibles passent à un humain** : juridique (titre foncier, bail, succession), fiscal, financement, questions discriminatoires. Elle ne répond pas, elle passe la main — **et continue la conversation** sur le reste pendant que le conseiller arrive. « Escalader n'est pas raccrocher. »
- **Un contrôle avant chaque envoi** : un message qui contiendrait un montant absent du catalogue est retenu.
- **Elle n'invente pas** : ce qui n'est pas dans la fiche du bien, elle dit qu'elle ne l'a pas.
- **L'urgence calculée** côté locataires, avec sa raison toujours affichée, et un chemin de sécurité dédié en cas de danger.
- **Elle dit qu'elle est un agent automatisé**, dès le premier message.
- **Tout est visible dans le tableau de bord** : chaque conversation, ce que l'agent a retenu, ce qu'il a fait, quand il a passé la main. L'agence peut **reprendre la main** sur une conversation à tout moment, puis la rendre.
- **Rien à installer, rien à changer** : l'agence garde son lien de prise de rendez-vous, ses annonces, ses habitudes. Il faut un numéro WhatsApp dédié à l'agent.
- **Les données de chaque agence sont cloisonnées** : un agent ne voit jamais les données d'une autre agence ; Amadou ne lit que les annonces de l'agence cliente.

### Formulations

Tutoiement exclu, **vouvoiement**. Phrases courtes, concrètes, sans jargon (« LLM », « IA générative », « tokens » : non). Le registre est celui d'un professionnel de l'immobilier qui parle à un autre : sobre, précis, chaleureux sans familiarité. On montre plutôt qu'on affirme : une conversation WhatsApp bien choisie vaut mieux qu'un paragraphe d'adjectifs.

---

## 5. Structure de la page d'accueil

Proposition — l'ordre et le découpage peuvent évoluer, pas le fond. Chaque section doit fonctionner seule sur un écran de téléphone.

1. **Ouverture** — la scène de 2 h du matin. Titre court et fort (piste : *« Il est 2 h à Dakar. Votre client à Paris vient d'écrire. »*), sous-titre qui dit ce qu'est le produit en une phrase, bouton **« Demander une démo »** (vers WhatsApp ou e-mail, §12). À droite sur grand écran, en dessous sur mobile : **un téléphone dans lequel une conversation WhatsApp se joue en direct** (voir §7, c'est la pièce maîtresse de l'animation). Le texte de la conversation reprend celle de la capture `mobile-lead-coumba-whatsapp.png` — un acheteur qui rentre au pays en décembre.
2. **Le problème, sans dramatiser** — ce que coûte un message sans réponse la nuit, le week-end, pendant une visite. Pas de chiffre inventé : la force vient de la situation, pas d'une statistique.
3. **L'équipe** — Coumba, Malick, Amadou. Trois cartes avec monogramme, métier, ce qu'ils font en deux lignes. Interaction : au survol / au tap, la carte montre un extrait de leur travail réel (une bulle de conversation pour Coumba, le badge « Urgent · situation qui s'aggrave » pour Malick, une fiche à moitié remplie « à confirmer » pour Amadou).
4. **Ce qu'elle ne fera jamais** — la section différenciante. Une liste nette des engagements interdits et des sujets qui passent à l'humain. Titre possible : *« Elle parle au nom de votre agence. Alors elle connaît ses limites. »*
5. **Le tableau de bord** — les captures desktop et mobile, mises en scène (appareils, léger parallaxe). Légende obligatoire : *« Données de démonstration. »*
6. **Comment ça se passe** — trois ou quatre étapes simples : un numéro WhatsApp dédié, vos biens au catalogue, votre lien de prise de rendez-vous, c'est en ligne. Ne pas promettre de délai d'installation.
7. **Questions fréquentes** — « Mes clients sauront-ils que c'est un robot ? » (oui, et c'est voulu), « Et si on lui pose une question juridique ? », « Est-ce que je garde mon numéro WhatsApp ? » (non : l'agent a son numéro dédié, le vôtre reste dans votre téléphone), « Puis-je reprendre la main ? », « Où sont mes données ? » (renvoi à la politique de confidentialité).
8. **Appel final** — « Demander une démo ».
9. **Pied de page** — liens vers les pages légales (§9), contact, « Codaya ».

---

## 6. Les captures du produit

Dossier `captures/`. **Ce sont de vraies captures de l'application**, pas des maquettes. Les données affichées sont des **données de démonstration** ; les noms de l'agence, des personnes réelles et tous les numéros de téléphone ont été masqués ou remplacés. **Toute capture publiée porte la mention « Données de démonstration ».** Ne pas retoucher le contenu des captures pour y ajouter des chiffres ou des noms.

| Fichier | Taille | Ce qu'on y voit | Usage conseillé |
|---|---|---|---|
| `mobile-lead-coumba-whatsapp.png` | 632×1568 | Coumba qui se présente comme automatisée et qualifie un acheteur diaspora (Villa Ngor Corniche, achat, retour en décembre) | **Héros** : dans un cadre de téléphone, ou comme source du texte de la conversation animée |
| `mobile-incident-malick.png` | 632×1568 | Dossier #248, badge « Urgent · situation qui s'aggrave », échange avec la locataire | Section Malick |
| `mobile-incident-faits-urgence.png` | 632×1568 | Les quatre faits établis par Malick, et le niveau « calculé depuis les faits ci-dessus » | Section garde-fous / urgence calculée |
| `mobile-conversations.png` | 632×1568 | Liste des conversations, leads et dossiers mêlés, badges Diaspora et Urgent | Section tableau de bord |
| `desktop-lead-coumba.png` | 2880×1800 | Fiche d'un lead : fil WhatsApp, ce que Coumba a retenu, demande de visite « lien envoyé » | Section tableau de bord (écran principal) |
| `desktop-incident-malick.png` | 2880×1800 | Fiche d'incident complète avec faits établis et niveau calculé | Section Malick ou tableau de bord |
| `desktop-conversations.png` | 2880×1800 | Toutes les conversations des agents | Section tableau de bord |
| `desktop-catalogue-amadou.png` | 2880×1800 | Amadou et le catalogue, « 2 champs à confirmer » | Section Amadou |

Toutes les captures sont en **résolution Retina (2×)** : les desktop correspondent à un écran de 1440×900, les mobiles à un écran de 390 px de large. Les convertir en **AVIF/WebP** avec `srcset`, garder un PNG de repli.

Le logo de l'agence en haut à gauche des captures est un logo de test : on peut le flouter ou recadrer.

---

## 7. Direction artistique et motion design

### Identité — reprise du produit, à respecter

Le site doit avoir l'air de la même maison que le tableau de bord (voir les captures). **Ivoire chaud** en fond, **vert profond** structurant, **ocre** en accent unique, **bleu-gris** en troisième couleur (associé à Amadou et au catalogue). **Instrument Serif** pour les titres et les chiffres, **Inter** pour tout le reste.

**Contrastes volontairement relevés** : le pastel est illisible sur un téléphone en plein jour à Dakar. Viser WCAG AA partout, AAA pour le texte courant.

**Thèmes clair et sombre, définis explicitement**, jamais par inversion automatique. Respecter `prefers-color-scheme`, avec un bouton de bascule.

Jetons exacts du produit (`apps/dashboard/app/globals.css`) :

| Jeton | Clair | Sombre | Rôle |
|---|---|---|---|
| `--brand` | `#1E4D3B` | `#4E9C77` | Vert profond, structure, boutons principaux, Coumba |
| `--brand-hi` | `#2A6B51` | `#63B48C` | Survol |
| `--accent` | `#A8742A` | `#CF9C4E` | Ocre — accent unique, Malick, badges diaspora |
| `--third` | `#3C6076` | `#7BA7C0` | Bleu-gris — Amadou, catalogue |
| `--ink` | `#13170F` | `#F2EDE3` | Texte principal |
| `--ink-2` | `#4E5449` | `#A9A294` | Texte secondaire |
| `--ink-3` | `#82887A` | `#7A7469` | Texte tertiaire (jamais pour du texte important) |
| `--bg` | `#F7F4EE` | `#131109` | Fond |
| `--surface` | `#FFFFFF` | `#1B1811` | Cartes |
| `--surface-2` | `#F0ECE3` | `#221E16` | Cartes secondaires, bulles entrantes |
| `--line` | `#E2DDD1` | `#2E2A23` | Bordures |
| `--neg` | `#A8452D` | `#C9705A` | Urgent, erreur |
| `--pos` | `#2C7450` | `#5AA87D` | Succès |

Rayons : 8 px, 14 px pour les grandes cartes, pilule 100 px. Courbe d'animation du produit : `cubic-bezier(.22, 1, .36, 1)`. Ombre : `0 1px 2px rgba(19,23,15,.04), 0 6px 20px -10px rgba(19,23,15,.12)`.

Références d'inspiration ayant servi au produit : *Hotel London* (thème clair), *The Arc* (thème sombre), *Luxury Interior* (rythme éditorial), *Paperpillar* (composants). Esprit : **éditorial, haut de gamme, calme** — plus magazine d'architecture que startup SaaS. Pas de dégradés violets, pas d'illustrations 3D génériques, pas de photos de banque d'images, pas de visages.

### Motion design — l'exigence

Le niveau attendu est celui d'un très bon studio : **chaque animation raconte quelque chose du produit**, aucune n'est décorative. Moins d'animations, mais parfaitement exécutées.

**La pièce maîtresse : la conversation qui se joue.** Dans le héros, un téléphone affiche WhatsApp à 2 h du matin. Le message de l'acheteur arrive (léger rebond, son de notification visuel), l'indicateur « en train d'écrire… » apparaît, puis la réponse de Coumba s'écrit. Ensuite, sur le côté ou en dessous, **ce que Coumba retient se remplit en direct** : « Intention : Achat », « Zone : Ngor », « Échéance : Sous 6 mois » — chaque ligne s'allume au moment où l'information apparaît dans la conversation. C'est la démonstration du produit en dix secondes, sans un mot d'explication. Elle doit pouvoir se rejouer, et s'arrêter quand elle sort de l'écran.

Autres moments, par ordre de priorité :

1. **L'heure qui tourne** : une horloge ou un horodatage « 02:07 » discret dans le héros, qui ancre la scène.
2. **L'urgence calculée** (section Malick) : les quatre réponses « Oui / Aucune / Non / Oui » s'affichent une à une, puis le badge « Urgent · situation qui s'aggrave » se compose à partir d'elles — on voit que le niveau *découle* des faits.
3. **Le passage de main** (section garde-fous) : une question sur le titre foncier arrive, la bulle se marque d'un liseré ocre, une notification « Un conseiller prend le relais » glisse vers un petit écran de tableau de bord — et la conversation continue.
4. **Les monogrammes des agents** : l'anneau coloré se dessine au premier affichage (tracé SVG), discret.
5. **Révélations au défilement** : fondu + translation de 12 à 24 px, échelonnées de 60 à 90 ms, déclenchées une seule fois.

Règles techniques :
- `prefers-reduced-motion: reduce` → toutes les animations remplacées par l'état final, sans exception. La conversation s'affiche entière.
- Animer uniquement `transform` et `opacity`. 60 images/s sur un téléphone Android d'entrée de gamme est le critère, pas un MacBook.
- Aucune animation ne bloque la lecture ou le clic. Rien ne se joue en boucle sous les yeux pendant qu'on lit.
- Bibliothèque au choix (Motion / GSAP / CSS pur) ; le poids JS total de la page doit rester raisonnable (viser < 100 Ko compressés hors images).

### Mobile first, concrètement

- Conception à **390 px**, vérification à **360 px** et 1440 px. **Aucun défilement horizontal** à aucune largeur.
- Zones de tap ≥ 44 px. Bouton d'appel à l'action visible sans défiler sur mobile.
- Le téléphone animé du héros passe **sous** le titre sur mobile, en taille utile (pas une vignette illisible).
- Texte courant ≥ 16 px. Interlignage généreux.
- Images : `srcset`, chargement différé sous la ligne de flottaison, dimensions déclarées (zéro décalage de mise en page).
- Objectif Lighthouse mobile : **≥ 95** en performance, accessibilité, bonnes pratiques et SEO.

---

## 8. Ce que le site doit contenir — pages

| Page | URL suggérée | Obligatoire pour Meta |
|---|---|---|
| Accueil (landing) | `/` | — |
| Politique de confidentialité | `/confidentialite` | **Oui** |
| Suppression des données | `/suppression-des-donnees` | **Oui** (URL d'instructions, ou callback) |
| Conditions d'utilisation | `/conditions` | **Oui** (champ « Conditions de service ») |
| Mentions légales | `/mentions-legales` | Non, mais obligatoire en droit français (structure française) |
| Contact | section de l'accueil ou `/contact` | Un e-mail de contact est exigé par Meta |

**Exigences Meta pour publier l'application** (App Dashboard → Paramètres → Général) : URL de la politique de confidentialité, URL des conditions de service, URL ou callback de suppression des données utilisateur, icône de l'application en **1024×1024**, catégorie, e-mail de contact. **Toutes ces pages doivent être publiques, accessibles sans connexion, en HTTPS, et répondre 200 au robot de Meta** (pas de page derrière un mur de cookies qui bloque le contenu).

Une icône d'application est donc à produire : sobre, lisible à 32 px, dans la palette (vert profond + ivoire ou ocre). Pas de visage.

---

## 9. Matière pour les pages légales — les faits

**Rédige à partir de ces faits et de rien d'autre.** Les textes légaux finaux devront être **relus par un juriste** : indique-le dans le rendu du projet, pas sur le site.

### Les rôles (montage arrêté)

- **L'agence immobilière cliente est responsable de traitement** des données de ses propres clients (acheteurs, candidats locataires, locataires). C'est elle qui décide de les collecter, et c'est son numéro WhatsApp que le particulier contacte.
- **La structure sénégalaise de Codaya** contracte avec les agences : **sous-traitant**.
- **La structure française de Codaya** fournit la technologie et porte les contrats d'infrastructure : **sous-traitant ultérieur**. Son existence règle l'obligation de représentant dans l'Union européenne.
- Les deux dénominations, adresses et numéros d'immatriculation sont **à fournir** (§12).

**Conséquence pour la politique de confidentialité :** elle doit couvrir deux publics distincts, et le dire clairement en tête de page :
1. **Les particuliers qui écrivent à une agence via WhatsApp** (le cas le plus fréquent, et celui qui intéresse Meta) ;
2. **Les agences clientes et leurs utilisateurs du tableau de bord.**

### Lois applicables

- **Sénégal** : loi n° 2008-12 sur la protection des données à caractère personnel ; autorité : **la CDP** (Commission de protection des données personnelles).
- **Union européenne** : **RGPD**, parce que la cible inclut des particuliers résidant en France et en Europe, et parce qu'une structure française intervient.
- ⚠ **La déclaration préalable à la CDP n'est pas encore déposée** (au 7 octobre 2026). Le site **ne doit pas** affirmer qu'elle l'est. Prévoir un emplacement `[À FOURNIR : numéro de récépissé CDP]` à compléter quand elle le sera.

### Données traitées — particuliers (via WhatsApp)

| Catégorie | Détail | Source |
|---|---|---|
| Identité de contact | Numéro WhatsApp ; nom de profil WhatsApp ; prénom et nom s'ils sont donnés dans la conversation | WhatsApp (Meta) / la personne |
| Contenu des échanges | Messages entrants et sortants, horodatages | La conversation |
| Photos | Photos envoyées par un locataire pour un incident (stockées, car les liens fournis par Meta expirent) | La personne |
| Projet immobilier (prospects) | Intention (achat / location), type de bien, zone, budget, échéance, remarques libres utiles au projet | Déduit de la conversation |
| Incidents (locataires) | Bien concerné tel que déclaré, nature du problème, quatre faits fermés (habitable, coupure, risque, aggravation), niveau d'urgence calculé, statut du dossier | Déduit de la conversation |
| Demandes de visite | Le fait qu'un lien de prise de rendez-vous ait été envoyé ou qu'un rappel ait été annoncé (pas de date de rendez-vous : le produit ne la connaît pas) | Le produit |
| Indicatif pays | Déduit du numéro — **le pays du numéro, pas celui de la personne** | Le numéro |

**Données non collectées, par règle du produit** : aucune donnée sur l'origine, la religion, la situation familiale, la santé ou le handicap n'est recherchée ni enregistrée ; les agents refusent de trier ou de filtrer sur ces critères.

**Finalités** : répondre aux demandes adressées à l'agence ; qualifier un projet immobilier pour que l'agence puisse y donner suite ; enregistrer et suivre les incidents des locataires ; permettre à l'agence de reprendre la conversation ; sécurité des personnes (chemin de sécurité en cas de danger). **Aucune revente, aucune publicité, aucun profilage marketing.**

**Décisions automatisées** : le niveau d'urgence d'un incident est calculé automatiquement à partir de quatre faits ; il peut être **forcé manuellement par l'agence**, et le forçage est tracé. Les agents ne prennent aucune décision engageante (voir §4 : prix, disponibilité, dossier, visite).

**Information de la personne** : les agents se présentent comme automatisés dès le premier message.

### Données traitées — agences clientes

Comptes du tableau de bord (nom, numéro de téléphone, mot de passe chiffré), sessions de connexion, réglages de l'agence (nom, logo, liens de prise de rendez-vous, domaines d'annonces, numéros d'urgence), catalogue des biens, identifiants techniques du compte WhatsApp Business (le jeton d'accès Meta est **chiffré au repos**).

### Sous-traitants et transferts (vérifiés dans le code au 7 octobre 2026)

| Prestataire | Rôle | Localisation des données |
|---|---|---|
| **Meta Platforms** (WhatsApp Business Cloud API) | Acheminement des messages WhatsApp | Selon Meta |
| **Anthropic** (modèle Claude Haiku 4.5) | Génération des réponses des agents et lecture des annonces | États-Unis — transfert hors UE à encadrer (clauses contractuelles types) |
| **Supabase** (PostgreSQL) | Base de données, y compris les photos des incidents | **Union européenne — Irlande** (région `eu-west-1`) |
| Hébergeur de l'application et du service de messagerie | — | `[À FOURNIR]` : pas encore choisi pour la production |

Ne pas affirmer que les données sont hébergées au Sénégal : c'est faux.

### Sécurité (ce qui est vrai)

Cloisonnement des données par agence (chaque donnée est rattachée à son agence, et toutes les lectures de l'application sont filtrées par agence) ; tables de la base fermées à tout accès public ; jetons d'accès WhatsApp chiffrés au repos ; vérification de la signature de chaque message reçu de Meta ; mots de passe hachés, jamais stockés en clair. Ne pas écrire que l'isolation est garantie « au niveau de la base » : elle est assurée par l'application. **Ne pas écrire** « chiffrement de bout en bout » (c'est une propriété de WhatsApp entre deux téléphones, pas de ce service) ni « certifié ».

### Durées de conservation

**Non définies à ce jour.** `[À FOURNIR]`. Proposition à faire valider : conversations et données de qualification conservées pendant la durée du contrat de l'agence, puis supprimées dans un délai à fixer ; comptes du tableau de bord supprimés à la fin du contrat. Ne rien publier tant que ce n'est pas arbitré.

### Droits des personnes et suppression des données

Droits : accès, rectification, effacement, opposition, limitation ; et pour les personnes relevant du RGPD, portabilité et réclamation auprès de la CNIL ; au Sénégal, réclamation auprès de la CDP.

**La suppression est aujourd'hui une procédure manuelle** — il n'existe pas de bouton de suppression d'un contact dans le produit. La page « Suppression des données » doit donc décrire une procédure honnête :
1. Écrire à `[À FOURNIR : e-mail de contact données personnelles]` en indiquant le **numéro WhatsApp** concerné et, si possible, le nom de l'agence contactée.
2. Une vérification simple que la demande vient bien du titulaire du numéro (par exemple un message de confirmation envoyé depuis ce numéro).
3. Suppression des messages, photos et données de qualification ou d'incident associés à ce numéro, chez toutes les agences clientes concernées, et confirmation par écrit.
4. Délai de traitement : `[À FOURNIR]` (un mois au plus au sens du RGPD).
5. Préciser que les messages restent dans l'application WhatsApp de la personne et dans les systèmes de Meta, qui relèvent de la politique de Meta.

Rappeler que, l'agence étant responsable de traitement, la personne peut aussi s'adresser directement à l'agence.

---

## 10. Choix techniques

Libres, avec ces contraintes :

- **Site statique** (Astro recommandé, ou Next.js en export statique). Pas de base de données, pas de compte, pas de suivi.
- **Aucun traceur publicitaire.** Si une mesure d'audience est voulue, un outil sans cookie (Plausible ou équivalent), sinon rien — ça évite aussi un bandeau cookies qui gênerait le robot de Meta.
- Polices **auto-hébergées** (Instrument Serif, Inter), `font-display: swap`, sous-ensembles latin.
- Contenu en **français** ; prévoir la structure pour une version anglaise plus tard sans la construire.
- SEO de base : titres, descriptions, Open Graph (image de partage 1200×630 dans la charte), `sitemap.xml`, `robots.txt`, balisage `Organization`.
- Déploiement Vercel ou Netlify ; une adresse provisoire (`*.vercel.app`) suffit pour soumettre l'application Meta en attendant le nom de domaine — les URL se changent ensuite dans Meta sans conséquence.
- Formulaire de contact : éviter un formulaire qui collecte des données personnelles sans backend sûr ; préférer un lien `wa.me` et un `mailto:`.

---

## 11. Critères d'acceptation

- [ ] Aucune affirmation de la liste « Ne jamais écrire » (§4). Relire la page entière avec cette liste à côté.
- [ ] Chaque capture du produit porte « Données de démonstration ».
- [ ] Aucun visage, aucune photo de personne, aucun agent autre que Coumba, Malick, Amadou.
- [ ] Rendu vérifié dans un vrai navigateur à 360, 390, 768 et 1440 px : pas de défilement horizontal, pas d'erreur JavaScript, menus et liens fonctionnels.
- [ ] `prefers-reduced-motion` respecté partout ; animations fluides sur un téléphone d'entrée de gamme.
- [ ] Thèmes clair et sombre tous deux soignés, contrastes AA minimum.
- [ ] Lighthouse mobile ≥ 95 sur les quatre axes.
- [ ] Pages légales publiques, en HTTPS, sans connexion, avec tous les `[À FOURNIR]` visibles tant qu'ils ne sont pas remplis.
- [ ] Icône 1024×1024 et image Open Graph livrées.

---

## 12. À fournir par Arouna

| Élément | Où il sert |
|---|---|
| **Nom du produit** et nom de domaine | Partout |
| Dénomination, forme, adresse, immatriculation de la **structure sénégalaise** | Mentions légales, confidentialité, conditions |
| Idem pour la **structure française**, et le directeur de la publication | Mentions légales (obligatoire en droit français) |
| **E-mail de contact** général, et e-mail dédié aux données personnelles | Contact, Meta, suppression des données |
| Numéro WhatsApp de démonstration / contact commercial | Bouton « Demander une démo » |
| **Hébergeur de production** | Mentions légales, confidentialité |
| **Durées de conservation** | Confidentialité |
| Délai de traitement des demandes de suppression | Suppression des données |
| Numéro de récépissé de la **déclaration CDP**, une fois déposée | Confidentialité |
| Logo du produit, s'il existe (sinon : à créer, en monogramme, dans la charte) | En-tête, icône Meta, favicon |

---

*Source de vérité : le dépôt `codaya-agents` — `docs/contexte-projet.md`, `docs/specifications-fonctionnelles.md` (§1, §4, §9, §10, §11, §16), `docs/architecture-technique-saas.md`, et le code. Si le produit évolue, c'est ce brief qu'on met à jour depuis ce dépôt, pas une copie dans le projet du site.*
