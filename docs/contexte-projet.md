# Contexte du projet — à lire en premier

*Document d'orientation. Toute conversation de ce projet commence ici : il dit qui fait quoi, ce qu'on vend, à qui, et où on en est. Les autres documents détaillent un domaine ; celui-ci donne la carte.*

Dernière mise à jour : 25 septembre 2026 (palier Premium et vitrine retirés de l'offre ; prise de rendez-vous par lien).

---

## Qui

**Arouna Watt**, développeur fullstack JavaScript, quatorze ans de métier. Il dirige **Codaya**, son agence. Il vit et travaille **à Dakar**.

**Deux structures juridiques, et la séparation est volontaire :**

- **La structure sénégalaise** contracte avec les agences immobilières clientes. Facturation en FCFA, droit sénégalais, déclaration à la CDP.
- **La structure française** fournit la technologie et porte les contrats d'infrastructure. Elle règle deux problèmes d'un coup : les paiements en euros et en dollars (Anthropic, Meta, hébergeur) que le Sénégal rend pénibles, et l'obligation de représentant dans l'Union européenne, qui disparaît puisqu'un établissement européen existe déjà.

Cette architecture à deux entités n'est pas un détail comptable : elle est un argument commercial face à une agence qui vise la diaspora, et elle conditionne le montage RGPD. Voir le document de conformité.

## Ce qu'on construit

**Un SaaS multi-tenant qui donne à une agence immobilière une équipe d'agents IA sur WhatsApp**, plus un tableau de bord pour les piloter.

Les agents sont **nommés et ont un métier**, parce que l'effet recherché chez le client est « j'ai du personnel », pas « j'ai un chatbot ». Depuis l'étude des prix du 24 septembre 2026, c'est aussi ce qui rend le prix défendable : des chatbots WhatsApp se vendent 20 000 à 60 000 FCFA par mois en Afrique de l'Ouest, et nous ne devons jamais être rangés dans cette case.

| Agent | Métier | Ce qu'il fait |
|---|---|---|
| **Coumba** | Chargée de clientèle | Répond aux acheteurs et candidats locataires sur WhatsApp, à toute heure. Qualifie budget, zone, délai. Envoie le lien de prise de rendez-vous de l'agence, ou annonce un rappel s'il n'y en a pas |
| **Malick** | Régisseur | Reçoit les demandes des locataires en place, avec photos. Pose des questions fermées, ouvre un dossier structuré, fait remonter l'urgent |
| **Amadou** | Agent catalogue | Lit une annonce en ligne de l'agence et prépare la fiche du bien. Ne remplit jamais un champ absent de l'annonce |
| **Sokhna** | Prospectrice | **Pas encore livrée.** Hors grille de prix. Visible et grisée dans l'interface, pour montrer que le produit avance sans avoir à le promettre |
| **Adja** | Assistante de direction | **Conçue le 25 septembre, pas construite.** Le premier agent dont l'utilisateur est le dirigeant : point d'activité poussé tous les X jours, et réponses à ses questions sur son affaire avec liens directs vers les fiches. Voir `agent-assistant-direction.md` |

**Ce qu'on ne construit pas pour l'instant : la vitrine** (site des biens sous le domaine de l'agence). Les agences visées publient déjà sur les plateformes ou sur leur propre site ; Coumba envoie leurs liens existants. La vitrine ajoutait un second produit à maintenir pour une valeur faible.

**Ni l'intégration aux agendas.** Une lecture des disponibilités par API — Google Calendar, Calendly — a été conçue puis abandonnée le 25 septembre : OAuth par tenant, deux intégrations à maintenir, pour une hypothèse non vérifiée sur l'équipement des agences. Coumba envoie le lien de prise de rendez-vous que l'agence utilise déjà. **La promesse « elle pose le rendez-vous dans votre agenda » ne doit plus être prononcée** — voir §10 des spécifications.

**Le principe technique central :** l'agent WhatsApp n'est pas un programme branché sur le dashboard, c'est un mode d'entrée-sortie du même backend. Les deux lisent et écrivent la même base. Il n'y a aucune synchronisation à construire.

## Ce qu'on vend, et à quel prix

Grille révisée le 25 septembre 2026, détail dans `modele-economique.md` :

| Offre | Contenu | Prix |
|---|---|---|
| Mise en service | Catalogue, numéro, templates, formation | 500 000 FCFA, une fois |
| Essentiel | Coumba + Amadou | 150 000 FCFA/mois |
| Complet | + Malick | 200 000 FCFA/mois |

Deux offres, choisies sur une seule question : l'agence gère-t-elle des locataires ? Offre de lancement pour les 3 à 5 premières agences : Essentiel à 100 000 FCFA/mois garanti 12 mois, mise en service offerte, contre une étude de cas. **Aucun de ces prix n'a encore été présenté à une agence.**

## Pour qui

**Les agences immobilières sénégalaises bien établies**, avec un angle particulier : celles qui traitent avec la **diaspora en France et en Europe**.

L'angle diaspora est ce qui fait passer l'idée de bonne à très bonne dans la grille Personal MBA — de 81 à 85 sur 100. La raison est mécanique : un acheteur à Paris écrit à 2 h du matin heure de Dakar, ne peut pas visiter avant son retour au pays, et engage des sommes importantes. L'agence qui répond en six heures le perd ; celle qui répond en quarante secondes le garde. C'est le seul segment où la valeur du produit se démontre en une seule capture d'écran.

**Taille du marché, mesurée le 24 septembre 2026** (`marche-agences-dakar.md`) : 264 agences passées au crible sur Dakar et la Petite-Côte, **76 cibles probables**, 140 au plus avec les « à qualifier ». C'est un plancher, mais l'ordre de grandeur est la centaine : on cherche peu de clients, bien payés, qui restent.

**Note sur le score Personal MBA :** il date d'avant ces recherches. Le potentiel de pricing et d'upsell baisse, la taille du marché est désormais mesurée, le coût d'acquisition, le coût de délivrance et la rapidité de mise sur le marché s'améliorent. Un re-scoring complet reste à faire.

## Où on en est — septembre 2026

**Fait :**

- L'idée est validée sur la grille Personal MBA (81/100, 85 en version séquencée) — à re-scorer avec les données de marché et de prix.
- Le produit est défini : trois agents livrés, un quatrième en feuille de route.
- Les **spécifications fonctionnelles** sont écrites, et c'est le document le plus important du projet : chaque règle y est accompagnée de la raison qui l'a fait naître. Seize sections, dont le périmètre de réponse des agents (§9) et la prise de rendez-vous (§10).
- L'**architecture technique** est arrêtée : Next.js pour le dashboard, service Node séparé pour les webhooks et les workers, Drizzle et Supabase en région européenne, R2 ou S3 pour les médias.
- Le **montage juridique** est posé : responsable de traitement l'agence, sous-traitant la structure sénégalaise, sous-traitant ultérieur la structure française.
- Une **maquette fonctionnelle du dashboard** existe, aboutie après une vingtaine d'allers-retours de conception. Elle sert de démonstration commerciale et de référence pour le développement.
- Une **liste de 27 agences prospects** plus trois plateformes partenaires, avec contacts, existe sous forme de tableur.
- **Le marché est mesuré** : tableur de qualification de 264 agences sur Dakar et la Petite-Côte, 76 cibles probables.
- **Le modèle économique est posé** : deux offres, mise en service, offre de lancement, ordres de grandeur de revenu. Premium et vitrine écartés le 25 septembre.

**Pas encore fait :**

- Aucune ligne du produit réel n'est écrite. Le dépôt `codaya-agents` n'est pas initialisé.
- **Démarches Meta non lancées** : vérification commerciale, App Review pour `whatsapp_business_management` et `whatsapp_business_messaging`, numéro WhatsApp dédié. Ce sont des délais incompressibles, à lancer très en amont du premier client.
- **Déclaration préalable à la CDP non déposée.** Elle est obligatoire *avant* tout traitement de données personnelles au Sénégal. Les sanctions vont de 500 000 à 100 millions de FCFA et jusqu'à sept ans.
- Aucune agence contactée. Aucun prix confronté au marché.
- L'heuristique de score des leads n'est pas définie : dans la maquette, le score est un nombre écrit en dur. **Laissé en l'état volontairement**, à combler quand de vraies conversations permettront de la calibrer.
- **Adja, l'assistante de direction, est conçue mais pas construite.** Trois décisions d'architecture doivent néanmoins être prises dès la première version pour ne pas la rendre coûteuse plus tard — voir son document.
- **À vérifier ou chiffrer** : les frais Meta sur les templates, le coût en salaires des 4,2 équivalents temps plein de l'argumentaire, l'encadrement légal des honoraires de location depuis 2023, le revenu mensuel qui rend le projet rentable pour Arouna, et si les agences de Dakar utilisent une page de prise de rendez-vous en ligne.

## Les règles de travail qui valent pour toutes les conversations

**Ne jamais afficher ni affirmer ce qu'on ne sait pas.** C'est la règle dont découlent la moitié des décisions produit. Un indicateur plausible mais invérifiable est pire qu'un indicateur absent : le jour où un patron d'agence demande d'où sort un chiffre et qu'on ne sait pas répondre, tout le reste devient suspect. Elle vaut autant pour une conversation de recherche que pour l'interface : une information non sourcée est signalée comme telle, jamais lissée.

**Évaluer les décisions de business sur la grille Personal MBA** (dix critères, note sur 100). En dessous de 50 on écarte, entre 50 et 75 il faut un effort substantiel, au-dessus de 75 c'est prometteur. La grille est disponible en compétence dédiée.

**Le code s'écrit en anglais, l'utilisateur lit du français.** Noms de fonctions, tables, colonnes, endpoints, branches, et aussi les noms et descriptions des outils exposés au modèle. Le français est réservé aux libellés vus par l'utilisateur final et aux messages envoyés aux particuliers.

**Le design doit être soigné.** Ce qu'on livre démontre qu'on sait faire : moderne, animé, contrasté. Le pastel est illisible sur un téléphone en plein jour à Dakar — les contrastes sont volontairement relevés.

**Ne jamais réécrire un document de ce projet depuis une copie locale sans l'avoir relu d'abord.** Plusieurs conversations écrivent dans les mêmes documents. `project_read`, comparaison, puis écriture — dans cet ordre.

## Les documents de ce projet

| Document | Ce qu'il contient | Quand l'ouvrir |
|---|---|---|
| `contexte-projet.md` | Ce document | Toujours, en premier |
| `specifications-fonctionnelles.md` | Toutes les règles produit arbitrées, avec leur raison | Avant de coder ou de décider d'un comportement |
| `architecture-technique-saas.md` | Stack, flux WhatsApp, multi-tenant, templates, modèle de données, coût d'API | Avant de toucher à la technique ou à Meta |
| `modele-economique.md` | Grille de prix, ce qui a été retiré et pourquoi, coûts variables, ordres de grandeur de revenu, questions ouvertes | Toute conversation sur le prix, la stratégie ou la rentabilité |
| `brief-prospection-agences.md` | Cible, argumentaire, objections, prix, séquence de contact | Conversation marketing, prospection, rédaction de messages |
| `marche-agences-dakar.md` | Taille du marché Dakar et Petite-Côte, méthode, prospects remarquables | Avant de cibler, de chiffrer un objectif de clients |
| `prix-comparables.md` | Ce que paient les PME au Sénégal : logiciels, chatbots, services | Avant de toucher au prix ou de répondre à « c'est cher » |
| `remuneration-agences.md` | Commissions des agences (vente, location, gestion) et cadre légal | Pour l'argument « une affaire en plus paie l'abonnement » |
| `brief-evenements-immobilier.md` | Objectif, critères, géographies, format de restitution | Conversation recherche de salons, conférences, webinaires |
| `agent-assistant-direction.md` | Adja : conception d'un quatrième agent, et surtout ce qu'il faut préparer dans le code dès la v1 | **Avant de coder le routage, les requêtes de lecture et les URL** |

**Trois documents manquent encore ici** et devront être versés : la conformité aux données personnelles, l'architecture produit et la différenciation, et la stratégie d'acquisition détaillée (dont le plan à 90 jours). Tant qu'ils ne sont pas là, le brief de prospection en contient l'essentiel opérationnel.
