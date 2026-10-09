# Spécifications fonctionnelles — règles du produit

*Rédigé le 2026-09-22, complété le 2026-09-23 (§3 l'urgence, §8 le catalogue des biens), le 2026-09-24 (§9 le périmètre de réponse des agents) et le 2026-09-25 (alignement sur la grille de prix, §10 la prise de rendez-vous par lien, §6 revenu à deux états). Consigne toutes les règles arbitrées pendant la conception du dashboard. C'est le document de référence au moment de coder : chaque règle ici a été décidée pour une raison, et la raison est écrite.*

---

## 1. Le principe directeur : ne jamais afficher ce qu'on ne sait pas

C'est la règle dont découlent la moitié des autres. Chaque chiffre, chaque badge, chaque libellé de l'interface doit correspondre à une donnée qu'on possède réellement. Un indicateur plausible mais invérifiable est pire qu'un indicateur absent : le jour où un patron d'agence demande d'où sort le chiffre et qu'on ne sait pas répondre, toute l'interface devient suspecte.

**Audit de ce qu'on sait et de ce qu'on ne sait pas :**

| Donnée | Disponible ? | Source |
|---|---|---|
| Fil complet des conversations | **Oui** | Webhook Meta, entrants et sortants stockés. Limite : rien de ce qui se dit hors du numéro connecté à la Cloud API |
| Photos envoyées par un locataire | **Oui, sous condition** | Meta ne donne qu'un `media_id` et l'URL expire : il faut télécharger le binaire immédiatement et le stocker. Un worker qui rate ce téléchargement perd la photo définitivement |
| Délai de réponse | **Oui** | Calculé sur nos propres horodatages |
| Fiche structurée d'un dossier | **Oui** | Sortie de l'outil `open_ticket` |
| Niveau d'urgence d'un dossier | **Oui, si calculé** | Déduit de faits fermés, jamais jugé par le modèle — voir §3 |
| Score d'un lead | **Oui** | Notre propre heuristique — à assumer comme telle, pas comme une vérité |
| Pays du numéro | **Oui** | Indicatif du `wa_id`. **Mais c'est le pays du numéro, pas celui de la personne** : libellé « numéro étranger », jamais « depuis l'Europe » |
| Ville de la personne | **Seulement si déclarée** | Le badge affiche « Diaspora · Paris » si le lead l'a dit, « Diaspora » sinon |
| Statut ouvert / résolu d'un dossier | **Oui** | Notre propre champ, positionné quand l'agence clôt |
| Attributs d'un bien | **Oui, ce qui est déclaré** | Formulaire de l'agence, ou lecture d'une de ses annonces par Amadou. Ce que l'annonce ne dit pas reste vide et marqué « à confirmer » — voir §8 |
| Date de disponibilité d'un bien | **Seulement si saisie** | Sinon « date à confirmer », jamais un mois plausible |
| Mode de visite (visio / sur place) | **Non fiable** | Souvent jamais précisé — indicateur supprimé |
| Visite réellement confirmée ou honorée | **Non** | On sait qu'un créneau a été proposé, pas qu'il a été tenu — voir §6 |
| Temps de réponse avant installation | **Une seule mesure** | Relevé pendant l'audit « lead fantôme ». Affiché en annotation datée, **jamais tracé comme une courbe** |
| Comportement sur la page du bien | **Non, et retiré de la feuille de route** | Il dépendait de la vitrine instrumentée, abandonnée le 2026-09-25 (`modele-economique.md`) |
| Historique des incidents par bien | **Non en phase 1** | Le catalogue existe, mais les dossiers n'y sont pas rattachés — voir §7 |

---

## 2. Qualification : champs contraints contre texte libre

**Le problème à éviter.** Si l'agent renvoie du texte libre pour qualifier un lead, on obtient « Villa 4 ch. », « Villa piscine », « F3 meublé », « Maison », « F2 » — cinq formulations pour trois réalités. Les filtres et les statistiques deviennent inexploitables en quelques semaines.

**La règle : deux couches strictement séparées.**

**Couche contrainte (`enum` dans le schéma JSON de l'outil `save_qualification`)** — elle seule alimente les puces, les filtres, le score et les statistiques :

| Champ | Valeurs |
|---|---|
| `intent` | achat · location · investissement · à qualifier |
| `property_type` | villa · appartement · terrain · local commercial · à qualifier |
| `zone` | liste des zones de l'agence (configuration par tenant) + autre |
| `budget` | montant + devise, ou drapeau « à qualifier » |
| `timeline` | immédiat · 3 mois · 6 mois · au-delà · à qualifier |

Le modèle ne peut pas produire une valeur hors liste : soit elle est dans l'enum, soit l'appel est rejeté et relancé.

**Couche libre (`notes`)** — ce qui ne rentre dans aucune case : « veut absolument la vue mer », « revient en décembre ». S'affiche dans le détail du lead, **jamais en puce, jamais dans un filtre**.

**Règle critique : « à qualifier » doit être une valeur autorisée de chaque enum.** Forcer un champ à être rempli sans porte de sortie pousse le modèle à inventer une valeur plausible pour satisfaire le schéma. On se retrouve avec des budgets crédibles et faux. La possibilité de dire « je ne sais pas » est ce qui garantit que les valeurs présentes sont vraies.

---

## 3. L'urgence d'un dossier : calculée, jamais jugée

C'est le seul champ du produit où une erreur a des conséquences physiques. Il a donc sa propre règle, et cette règle ne délègue pas le jugement au modèle.

### Pourquoi ne pas demander à l'agent « est-ce urgent ? »

Le modèle répondrait à la **formulation** autant qu'aux faits. Un locataire qui écrit en majuscules avec trois points d'exclamation pour une ampoule grillée passerait en urgent ; une personne qui signale calmement une odeur de gaz ne passerait pas. Deux dossiers identiques à deux semaines d'intervalle n'auraient pas la même étiquette. Et le jour où l'agence demande pourquoi un dossier n'était pas marqué urgent, il n'y aurait aucune réponse à donner.

### La règle : l'agent établit des faits, le code en déduit un niveau

Malick ne qualifie jamais l'urgence. Il pose des questions **fermées et factuelles**, stockées en enum :

| Champ | Valeurs |
|---|---|
| `habitable` | oui · non · partiellement |
| `utility_cut` | aucune · eau · électricité · eau et électricité |
| `safety_risk` | oui · non — porte ou fenêtre qui ne ferme plus, installation dangereuse |
| `worsening` | oui · non — la situation continue de s'aggraver en ce moment |

Le niveau est ensuite **calculé en code**, pas dans le prompt :

- **Urgent** — si `habitable = non` ou `partiellement`, ou `utility_cut ≠ aucune`, ou `safety_risk = oui`, ou `worsening = oui`
- **Faible** — si la demande est purement administrative
- **Normal** — tout le reste

### Trois bénéfices, et ils sont la raison d'être de la règle

**Auditable** — on peut toujours expliquer : *« urgent parce que le locataire a répondu que l'eau était coupée »*. **Stable** — mêmes faits, même classement, toujours. **Paramétrable par agence** — certaines considèrent une climatisation en panne comme urgente en avril à Dakar, d'autres non ; c'est de la configuration, pas une réécriture de prompt.

### Le badge porte sa propre justification

Jamais « Urgent » seul, toujours **« Urgent · eau coupée »**. Cohérent avec le reste de l'interface : chaque affirmation affiche d'où elle vient.

### Le chemin de sécurité, distinct de l'échelle d'urgence

Odeur de gaz, départ de feu, inondation en cours, installation électrique qui fume, personne blessée : ces cas **ne sont pas un niveau de plus dans l'échelle**. Ouvrir un dossier en répondant « c'est bien noté, l'agence revient vers vous » y serait une mauvaise réponse, potentiellement dangereuse.

Traitement distinct et obligatoire :

1. L'agent donne **immédiatement la consigne de sécurité** — couper l'arrivée, sortir du logement, appeler les secours.
2. Il affiche les **numéros d'urgence configurés par l'agence** pour sa ville. Ces numéros sont de la configuration par tenant, jamais des valeurs codées en dur.
3. Il **escalade sur-le-champ vers un humain** avec notification poussée — pas une ligne supplémentaire dans une liste que le patron lira le lendemain matin.

Dans l'interface, ces dossiers portent une bannière de sécurité en tête de fiche, distincte du badge d'urgence.

### Recalcul et forçage

Le niveau est **recalculé à chaque nouveau fait** : « maintenant ça déborde » fait monter le dossier.

L'agence peut **forcer le niveau manuellement**, et ce forçage est tracé — qui l'a changé, quand, depuis quelle valeur. C'est ce qui protège l'agence et Codaya le jour où il y a un litige.

---

## 4. Les agents

Trois agents actifs, nommés et dotés d'un métier — le dashboard est organisé autour d'eux, pas autour des fonctionnalités. L'effet recherché est « j'ai du personnel », et c'est ce qui rend littéral l'argument commercial.

| Agent | Métier | Périmètre |
|---|---|---|
| **Coumba** | Chargée de clientèle | Acheteurs et candidats locataires. Qualifie, oriente vers la fiche du bien, propose les créneaux de visite |
| **Malick** | Régisseur | Locataires en place. Reçoit les demandes avec photos, pose les questions, ouvre les dossiers |
| **Amadou** | Agent catalogue | Lit une annonce de l'agence et prépare la fiche du bien — voir §8 |
| **Sokhna** | Prospectrice | **Grisée, « bientôt »** — hors grille de prix tant qu'elle n'existe pas (`modele-economique.md`) |
| **Adja** | Assistante de direction | **Conçue, pas construite** — voir `claude/agent-assistant-direction.md`. Ne pas la promettre en rendez-vous |

**Ce que chaque agent a le droit de dire est au §9**, et ce n'est pas un détail de rédaction : le comportement par défaut d'un modèle est de répondre à tout, y compris sur le juridique et le fiscal.

**Trois agents parlent aux clients de l'agence, un parlera à l'agence elle-même.** Adja, l'assistante de direction, inverse le rapport : son utilisateur est le dirigeant. Les interdictions d'engagement du §9 ne la concernent plus, mais deux règles autrement plus strictes la remplacent — **la frontière de tenant ne se franchit jamais**, et **le modèle n'écrit aucune requête**, il appelle des outils bornés filtrés côté serveur. Le détail est dans son document.

**Un seul runtime, plusieurs profils.** Le régisseur n'est pas une seconde application : même moteur, autre jeu de prompts et d'outils. Le routage se fait sur l'identité du contact — locataire connu en base → profil `property_manager`, inconnu → profil `sales`.

**L'agence ne crée pas d'agents.** Aucun bouton « ajouter un agent » nulle part : les agents sont ce que nous livrons, pas ce que le client configure.

**Pas de visages photoréalistes.** Monogrammes avec anneau coloré. Les agents parlent à de vrais acheteurs et locataires sur WhatsApp : des portraits photo dans l'interface encouragent l'agence à oublier qu'il s'agit d'automates, et le client final à croire qu'il écrit à une personne.

**L'agent se présente comme automatisé dès son premier message.** C'est l'obligation d'information (le document de conformité reste à verser dans ce projet), et c'est visible dans les fils de conversation de la maquette.

---

## 5. Messages sortants : la règle des infobulles

Contrainte de plateforme : hors de la fenêtre de 24 h, seuls passent des **templates pré-approuvés**. L'agent ne rédige pas ses relances, il choisit un template et remplit ses variables.

**Règle d'interface : aucun bouton n'envoie un message WhatsApp sans que l'utilisateur ait pu lire ce message avant de cliquer.** Chaque bouton concerné porte une infobulle, et son contenu dépend de la nature de l'action :

- **Le bouton envoie une information neutre** → l'infobulle affiche **le texte exact du template** qui va partir.
- **Le bouton engage l'agence à faire quelque chose** → l'infobulle affiche **un avertissement**, pas le message.

Exemple du second cas, « Reprendre la main » : *« Le client reçoit immédiatement un message lui annonçant qu'un conseiller va le contacter. Ne cliquez pas si vous ne pouvez pas l'appeler rapidement. »*

**Bibliothèque de templates** (noms et variables en anglais, contenu en français — voir `claude/architecture-technique-saas.md`) : `lead_followup_no_reply`, `lead_reengage`, `new_listing_match`, `visit_slot`, `visit_slot_followup`, `ticket_received`, `ticket_status_update`, `handover`.

`appointment_confirmation` et `appointment_reminder` ont été retirés le 2026-09-25 : sans lecture d'agenda, nous ne connaissons ni la date ni l'heure d'un rendez-vous, et l'outil de réservation de l'agence envoie déjà les siens (§10).

**Aucun template ne porte de lien, et aucun ne demande d'écrire « OUI ».** Chaque template se termine par une question fermée avec des **boutons de réponse rapide**. Le doigt du prospect sur un bouton est un message entrant : il rouvre la fenêtre de 24 h et rend à l'agent toute sa liberté — texte libre, liens, photos, n'importe quel domaine. **Le template sert à rallumer la conversation, pas à la mener.**

Un bouton plutôt qu'une consigne écrite, pour trois raisons : meilleur taux de réponse, réponse structurée en payload plutôt qu'un « ok » ou « pourquoi pas » à interpréter, et aucun texte libre à faire approuver.

**Toute relance marketing porte un bouton de retrait** — « Ne plus me contacter » — qui coupe les relances sur ce contact. C'est l'opposition au sens de l'article 21 du RGPD, et c'est aussi ce qui protège la note de qualité du numéro de l'agence.

---

## 6. Machines à états des boutons

### Visite — deux états, et un aller-retour de conception à ne pas refaire

**Trois états avaient été introduits le matin du 25 septembre**, quand les créneaux devaient venir du calendrier réel de l'agence : un tap sur « Ce créneau me va » créait un événement, donc on savait. L'après-midi, l'intégration a été abandonnée au profit d'un simple lien (§10). La prémisse a disparu, l'état aussi.

| État | Bouton du tableau de bord | Template |
|---|---|---|
| Rien d'engagé | « Proposer une visite » (principal) | `visit_slot` |
| Lien envoyé, ou rappel annoncé | « Relancer » (secondaire) + panneau indiquant quand, et par quel moyen | `visit_slot_followup` |

**Ce qu'on ne saura pas : si le prospect a réservé, quand, et s'il est venu.** La réservation se passe sur l'outil de l'agence, qui ne nous dit rien. L'interface ne doit laisser croire aucune des trois.

**La leçon de méthode, qui vaut au-delà de ce cas.** Un état d'interface n'existe que tant que la source qui l'alimente existe. En quelques heures, cet état est né d'une décision d'intégration puis mort avec elle. Avant d'ajouter un état, la question n'est pas « est-ce utile ? » mais **« qu'est-ce qui le remplit, et que se passe-t-il le jour où cette source disparaît ? »**

### Reprendre la main — un avant et un après

| État | Bouton | Infobulle |
|---|---|---|
| Main non reprise | « Reprendre la main » | Avertissement : le client sera notifié, ne cliquez que si vous appelez tout de suite |
| Main déjà reprise | « Main déjà reprise », désactivé | *« Le client a été notifié qu'on le contacterait. Si ce n'est pas encore fait, appelez-le maintenant. »* |

### Dossier — clore et rouvrir

Bouton « Clore le dossier » quand il est ouvert, **« Rouvrir le dossier » quand il est résolu**. La bascule met à jour le statut, les listes et les compteurs.

### Bien — publier et dépublier

Bouton « Dépublier » quand le bien est publié, **« Publier » quand il ne l'est pas**. Cette bascule ne touche jamais à la disponibilité — voir §8.

### Appeler — comportement par appareil

Sur mobile, le lien `tel:` compose directement. Sur ordinateur, composer n'a pas de sens : le clic **révèle le numéro** et le copie dans le presse-papier.

---

## 7. Les dossiers, sans rattachement au catalogue

Rattacher un locataire à un bien du catalogue supposerait que l'agence ait saisi **tous** ses biens loués à l'onboarding, y compris ceux qu'elle ne met pas en vitrine. On ne l'a pas en phase 1, et l'exiger ralentirait chaque déploiement. Le catalogue du §8 sert à Coumba pour proposer des biens à des acheteurs, pas à identifier le logement d'un locataire en place.

**À la place** : Malick demande « vous êtes locataire de quel bien ? » et **la réponse brute du locataire devient le titre du dossier**. Pas de référence structurée du type « Villa Almadies — lot 12 », mais « La villa blanche aux Almadies, celle avec le portail vert » ou « Mermoz, 4e étage porte A ».

Dans la fiche, le champ s'appelle **« Bien, tel que déclaré »** — le libellé dit lui-même que c'est du déclaratif non vérifié.

Conséquence assumée : pas d'historique d'incidents par bien en phase 1.

---

## 8. Le catalogue des biens

Le catalogue n'est pas un module de phase 2. Coumba ne peut rien proposer à un acheteur tant qu'il est vide : elle répond vite, mais elle répond dans le vide. C'est le premier écran à remplir après l'installation, et c'est ce qui rend Amadou nécessaire.

### Amadou, agent catalogue

L'agence colle l'adresse d'une de **ses** annonces en ligne. Amadou la lit et pré-remplit le formulaire. L'agence relit, corrige, enregistre.

**Amadou ne remplit jamais un champ absent de l'annonce.** Il le laisse vide et le marque « à confirmer ». C'est la même règle que le « à qualifier » du §2 : la possibilité de ne pas savoir est ce qui rend vraies les valeurs présentes. Une surface inventée dans une fiche publiée est une information fausse donnée à un acheteur.

**Amadou ne lit que les annonces de l'agence.** Aspirer celles d'une autre agence poserait un problème de droits et de données personnelles. La limite est technique autant que commerciale, et elle est écrite dans l'interface.

Le formulaire est aussi utilisable seul, sans URL. Trois provenances, un seul écran : création vierge, pré-remplissage par Amadou, modification d'un bien existant. Depuis le détail d'un bien, « Modifier » rouvre ce même formulaire pré-rempli — le bloc URL disparaît alors, un bien déjà en base n'a plus à être importé.

### Champs contraints du bien

Mêmes deux couches qu'au §2 : tout ce qui est filtrable est en liste fermée, le reste va dans `notes`.

| Champ | Valeurs |
|---|---|
| `transaction` | vente · location longue durée · location courte durée |
| `type` | appartement · villa · terrain · local commercial · à qualifier |
| `typology` | studio · F1 · F2 · F3 · F4 · F5 · F6+ · — |
| `furnished` | meublé · non meublé · partiellement · à qualifier · — |
| `charges` | hors charges · charges comprises · — |
| `period` | mois · semaine · nuit · — |
| `availability` | disponible · à partir du… |
| `status` | publié · dépublié |
| `amenities` | liste fermée de 12 équipements |
| `services` | liste fermée de 6 services inclus |

**Piège vérifié en pratique.** En construisant les données de démonstration, deux valeurs hors liste s'étaient glissées dans `services` : « Ménage 3×/semaine » et « Terrasse commune ». Exactement la dérive que la règle interdit, commise par celui qui venait de l'écrire. **Un validateur d'enums doit tourner en intégration continue sur toute fiche créée ou modifiée**, y compris celles produites par Amadou. Le détail — « femme de ménage trois fois par semaine », « terrasse commune sur le toit » — appartient à `notes`, qui s'affiche dans le détail du bien sous « Notes libres » et n'alimente aucun filtre.

Le texte de l'annonce d'origine est **conservé brut** dans `raw_listing` et affiché tel quel. Il sert de preuve : on peut toujours vérifier ce qu'Amadou a lu et ce qu'il en a fait.

### Publication et disponibilité sont deux axes indépendants

C'est la règle la plus facile à rater, parce que les deux notions se ressemblent.

**`status` — publié ou dépublié.** Décision commerciale de l'agence : la fiche est-elle visible dans le catalogue et Coumba peut-elle la proposer ? Deux valeurs, jamais déduites d'autre chose. Le formulaire porte un interrupteur explicite, dans une carte séparée intitulée « Publication », avec la mention « indépendant de la disponibilité ».

**`availability` — disponible ou à partir du…** Fait matériel sur le bien : est-il libre maintenant, ou à une date donnée ? Deux valeurs seulement. Si « à partir du… » est choisi, **une date est obligatoire**, saisie dans un sélecteur de date natif (`input[type=date]`), qui ouvre le calendrier du système sur mobile et évite un composant maison à retoucher pour chaque taille d'écran. Le champ de date n'apparaît que quand il a un sens, et il bascule sans re-rendre le formulaire pour ne pas effacer la saisie en cours.

**Les quatre combinaisons sont légitimes**, et c'est la raison de la règle :

| | Disponible | À partir du… |
|---|---|---|
| **Publié** | cas courant | villa louée jusqu'en janvier, déjà en vitrine pour prendre les candidatures en avance |
| **Dépublié** | bien libre qu'on ne veut pas encore diffuser | bail en cours, fiche préparée mais pas ouverte |

L'ancienne valeur « occupé » a été supprimée : elle mélangeait les deux axes. Un bien occupé est un bien dont la disponibilité est « à partir du » telle date — et sa publication reste un choix séparé. De même, « brouillon » n'est pas un troisième statut : un bien incomplet est un bien dépublié, et le badge « X à confirmer » dit déjà pourquoi.

**Jamais de date inventée.** Si `availability = à partir du…` sans date, l'interface affiche « date à confirmer », pas un mois plausible. Une date approximative stockée en texte libre (« novembre ») est inexploitable pour trier et dangereuse à afficher à un candidat locataire.

### Le lien de l'annonce

Sans lien, Coumba peut décrire un bien mais n'a rien à envoyer. Un acheteur qui demande « vous avez une fiche ? » repart les mains vides, et tout le travail de qualification tombe à plat. Le champ `listing_url` est donc aussi structurant que le prix.

**Il est pré-rempli par l'adresse donnée à Amadou.** Quand le bien vient d'un pré-remplissage, la page qu'Amadou a lue est la page publique du bien : c'est le même lien. Il reste **modifiable**, parce que l'adresse lue n'est pas toujours celle qu'on veut envoyer — une agence peut faire lire une annonce Expat-Dakar et préférer diffuser la fiche de son propre site.

**N'importe quel domaine fonctionne.** Les templates de relance ne portent aucun lien — ils rouvrent la fenêtre de 24 h, et les liens partent ensuite en message libre, où rien n'est contraint. Voir `claude/architecture-technique-saas.md` pour la mécanique et la raison du choix. L'interface ne pose donc aucune limite technique sur le domaine.

**Quatre états, et un seul déclenche un avertissement.** C'est le §1 appliqué à la lettre : on ne prévient que pour un site qu'on **reconnaît**.

| État | Ce qu'on sait | Affichage |
|---|---|---|
| `propre` — un domaine de l'agence | C'est chez elle | Rien : le cas normal |
| `place` — une place de marché **identifiée** | On sait que ce site affiche les biens des autres agences | Bandeau ocre nommant le site, puce « Sur Expat-Dakar » en liste |
| `autre` — un domaine non reconnu | **Rien du tout** | Rien |
| `aucun` — pas de lien | Coumba n'a rien à envoyer | Bandeau rouge, puce « Sans lien d'annonce » si le bien est publié |

**L'erreur à ne pas refaire.** La première version affichait l'avertissement « cette page montre les annonces de vos concurrents » sur **tout** domaine qui n'était pas celui de l'agence. C'était une affirmation sur ce qu'on ne sait pas : un domaine tiers peut être un PDF sur Drive, une visite en vidéo, la page Facebook de l'agence. Un avertissement faux use la confiance plus vite qu'une absence d'avertissement.

**La liste des places de marché est une donnée de référence tenue par Codaya, par pays** — Expat-Dakar, SenImmo, CoinAfrique, Jumia Deals pour le Sénégal ; SeLoger, Bien'ici, leboncoin pour la France. Elle est explicite et vérifiable, pas déduite. Un domaine absent de la liste ne reçoit aucun commentaire.

**Les domaines de l'agence sont de la configuration par tenant, au pluriel** : une agence peut avoir un site et un sous-domaine d'annonces. La comparaison se fait sur l'hôte, sous-domaines inclus — `biens.agence.sn` compte comme `agence.sn`, mais `faux-agence.sn` non. Ils ne conditionnent plus rien de technique depuis que les templates ne portent aucun lien (§5) : ils servent uniquement à distinguer « chez soi » du reste.

**L'absence de lien n'empêche pas de publier.** Beaucoup d'agences à Dakar n'ont pas de site au démarrage ; bloquer la publication rendrait le produit inutilisable chez elles. On signale, on n'interdit pas.

**Jamais de lien reconstruit.** `get_property` renvoie `listing_url` s'il existe, et rien sinon. Deviner une adresse à partir de la référence du bien produirait des liens morts envoyés à de vrais acheteurs — la même faute que d'inventer une surface.

### Affichage

Dans la liste, chaque ligne porte le badge de publication, puis le badge de disponibilité **quand elle n'est pas immédiate** — « À partir du 1er novembre 2026 », date formatée en français. Un bien disponible tout de suite ne porte pas de badge de disponibilité : l'absence de mention veut dire « libre maintenant ».

Dans le détail, publication et disponibilité sont deux lignes distinctes de la fiche des caractéristiques, et le bouton d'action bascule entre « Publier » et « Dépublier ».

---

## 9. Le périmètre de réponse des agents

C'est la règle qui protège l'agence, et c'est celle qu'on oublie parce que **le comportement par défaut est précisément le risque**. Un bon modèle, laissé à lui-même, converse remarquablement bien et répond à tout — y compris sur le titre foncier, la fiscalité de l'investissement ou la sécurité d'un quartier, avec un aplomb parfait et sans aucun moyen pour le client de savoir qu'il vient d'être mal renseigné. Ce message part au nom de l'agence.

Trois choses se règlent donc séparément : **ce dont un agent parle**, **ce qu'il ne peut jamais engager**, et **quand il passe la main**.

### Ce qui reste libre, et c'est le cœur du produit

Rien de ce qui suit ne remet en cause la conversation elle-même. Dans la fenêtre de 24 h, l'agent converse en texte libre, s'adapte au registre du client, relance, revient en arrière. Il n'y a ni arbre de décision ni parcours scripté.

**La qualification est opportuniste, jamais un interrogatoire.** L'agent n'a pas de questionnaire à finir. Chaque fois qu'un fait tombe dans la conversation, il appelle `save_qualification` et l'enregistre — pas à la fin, pas en rafale. Une question à la fois, et seulement quand elle sert la conversation. Si l'information arrive d'elle-même, on ne la redemande pas. Et comme « à qualifier » est une valeur autorisée partout (§2), une conversation peut se terminer sans budget connu : c'est un résultat acceptable, pas un échec.

Ce qui ne rentre dans aucune case va dans `notes` — « sa femme est enceinte, il lui faut une chambre de plus », « il a déjà visité chez un concurrent », « il paie comptant ». C'est souvent ce qui vaut le plus, et c'est ce qui permet de garder les enums serrés sans perdre l'intelligence de l'échange.

### Les trois zones de Coumba

| Zone | Périmètre | Comportement |
|---|---|---|
| **Verte** | Les biens du catalogue, les modalités de visite, les horaires et coordonnées de l'agence, les étapes du parcours telles que l'agence les a décrites | Réponse libre, adossée à `search_properties` et `get_property`. Ce qui n'est pas dans la fiche, elle dit qu'elle ne l'a pas |
| **Orange** | Le quartier, l'environnement, les généralités | **Elle situe, elle ne chiffre pas** — voir ci-dessous |
| **Rouge** | Juridique, fiscal, financier, discriminatoire, et tout engagement | Elle ne répond pas. Elle escalade |

**La zone orange, précisément.** Elle peut décrire un quartier par des faits **stables et vérifiables** : résidentiel ou commerçant, en bord de mer ou non, proximité d'un axe, présence d'écoles ou de commerces. Lui sont interdits, même si le client insiste : tout prix ou ordre de grandeur hors catalogue, toute tendance ou prévision — « est-ce que ça va monter à Diamniadio ? » n'a pas de réponse honnête —, et **tout jugement sur la sécurité, la réputation, la qualité de vie ou le voisinage**, qui est à la fois invérifiable et lourd de conséquences.

Règle de formulation qui va avec : dans cette zone, **elle attribue ou elle se tait**. « D'après la fiche », « d'après l'agence ». Jamais une affirmation flottante dont personne ne pourra dire d'où elle sort — c'est le §1 transposé dans la conversation.

**La zone rouge de Coumba**, nommément : régularité juridique d'un bien et titre foncier, bail et droit locatif, succession et indivision, fiscalité, financement et crédit, frais de notaire et d'enregistrement, conseil en investissement et rendement attendu.

Ce n'est pas une faiblesse commerciale, c'est l'inverse. Ces questions sont exactement celles que pose un acheteur diaspora sérieux, et ce sont celles où la vente se joue : **c'est le moment où l'on veut un humain au bout du fil.** L'escalade est le bon réflexe métier, pas un aveu.

### La non-discrimination est une zone rouge à part entière

« Est-ce qu'il y a beaucoup d'étrangers dans l'immeuble ? », « le propriétaire accepte les familles nombreuses ? », « c'est un quartier plutôt de quelle communauté ? » — ce sont des questions qu'un agent immobilier reçoit réellement.

L'agent ne répond pas, ne filtre pas le catalogue là-dessus, et ne stocke rien de tel dans `notes`. Il ramène poliment la conversation sur les critères du bien. Un tri sur l'origine, la religion, la situation familiale, l'état de santé ou le handicap est illégal et le resterait quand bien même l'agence le demanderait : **c'est de la zone rouge non dérogeable**, y compris sur demande expresse d'un client.

### Les engagements interdits — pour tous les agents, sans exception

Plus dangereux encore qu'une information fausse. Un message WhatsApp d'une agence qui dit « oui, on peut faire 270 millions » pèse dans une négociation, et il part sous son nom.

Aucun agent ne peut : **négocier, accepter ou annoncer un prix ou une remise** ; **promettre une disponibilité ou réserver un bien** ; **accepter ou valider un dossier de candidature** ; **confirmer une visite comme définitive** — il propose, l'agence confirme, ce qui est déjà la machine à deux états du §6 ; **s'engager sur un délai, un coût de travaux ou sur qui paie** ; **promettre un rendement**.

Ces interdictions ne sont configurables par personne.

### Les zones de Malick

Son métier n'est pas le même, ses zones non plus.

**Verte** — la prise en compte de la demande, les quatre questions fermées du §3, le numéro de dossier, et la consigne de sécurité du chemin de sécurité, qui reste prioritaire sur tout le reste.

**Orange** — des **gestes conservatoires simples et sans risque**, destinés à limiter les dégâts en attendant : fermer un robinet d'arrêt, couper un disjoncteur, éponger, déplacer ce qui craint l'eau. Ce n'est pas du conseil technique. Lui sont interdits tout diagnostic de la panne et toute instruction de réparation.

**Rouge** — le délai d'intervention, le coût, qui prend en charge, l'interprétation du bail, et toutes les questions juridiques locatives : congé, dépôt de garantie, augmentation de loyer, travaux à la charge de qui, expulsion. Ce sont, très exactement, les questions les plus fréquentes d'un locataire — et elles sont toutes juridiques.

**Il constate, il n'engage rien.** Il confirme que la demande est prise en compte et qu'un créneau sera communiqué. Pas de délai annoncé, même si l'agence en a un d'habitude : une promesse d'automate non tenue devient un litige, et la réactivité mesurable suffit déjà à produire l'effet recherché.

### Amadou n'a pas de zone de conversation

Il ne parle à aucun particulier. Son périmètre est un périmètre **de lecture**, et il est déjà écrit au §8 : il ne lit que les annonces de l'agence cliente, et il ne remplit jamais un champ absent de l'annonce.

### L'escalade

**Ce qui la déclenche :** l'entrée en zone rouge, une demande explicite de parler à quelqu'un, une insatisfaction ou une détresse manifeste, ou trois tours de conversation sans progrès.

**En cas de doute, on escalade.** L'asymétrie est nette : une escalade inutile coûte une minute à l'agence, une escalade manquée coûte un client ou un litige. C'est le seul endroit de ce document où l'on préfère l'excès à la prudence.

**Escalader n'est pas raccrocher.** L'agent appelle `escalate_to_human(reason)`, le tableau de bord est notifié, et **la conversation continue** : il peut toujours répondre en zone verte pendant que le conseiller arrive. Se taire d'un coup après vingt messages est la pire des sorties.

**Hors des horaires de l'agence**, il annonce le rappel **sans donner d'heure** : *« Un conseiller vous recontacte dès l'ouverture. »* C'est vrai, c'est tenable, et ça n'engage sur aucun créneau que l'agence pourrait rater. Annoncer « avant 10 h » serait une promesse au nom du client — et la diaspora est justement le segment qui écrit la nuit, donc celui où cette promesse serait faite le plus souvent.

**Chaque escalade est tracée avec son motif**, comme le forçage d'urgence du §3. C'est ce qui permet, le jour d'un litige, de montrer ce que l'agent a dit et pourquoi il a passé la main.

### Ce qui est figé, ce qui se règle

**La zone rouge est figée dans le produit et n'est modifiable par personne**, pas même sur demande d'un client qui trouverait son agent trop timide. C'est ce qui protège Codaya, et c'est un argument de vente : l'agence sait que son automate ne s'aventurera jamais sur le terrain juridique.

**La zone orange est un réglage d'onboarding**, avec **deux niveaux prédéfinis** et non un champ de texte libre — un champ libre reviendrait à laisser le client injecter des instructions dans le prompt, ce qui est une faille, pas une fonctionnalité.

| Niveau | Comportement |
|---|---|
| `listing_only` | Hors des données du catalogue, elle renvoie au conseiller |
| `neighbourhood` *(défaut)* | Elle situe sans chiffrer, selon les règles ci-dessus |

Un troisième niveau, qui autoriserait à parler du marché et des prix comme un commercial, **n'est pas proposé**. Il ferait meilleure impression sur le moment et produirait des affirmations fausses au nom de l'agence.

### Ne jamais s'appuyer sur le seul prompt

Une consigne de refus dans un prompt fuit — après trente messages, face à un client insistant, ou à la faveur d'une reformulation. Quatre couches, pas une :

1. **Le prompt** porte la règle, par profil d'agent.
2. **`escalate_to_human` est un outil**, et le modèle y est fortement poussé sur les sujets rouges : c'est une action, pas une intention.
3. **Un contrôle sur le message sortant, avant envoi.** Un message qui contient un montant absent du catalogue, ou un terme de la liste rouge, est retenu et bascule en escalade. Même logique que l'urgence du §3 : on ne confie pas au modèle un jugement dont l'erreur coûte cher.
4. **Un jeu de conversations pièges rejoué à chaque changement de prompt.** Le client qui insiste trois fois pour avoir un prix, celui qui pose une question discriminatoire, celui qui demande si le titre foncier est en règle, celui qui négocie. C'est la seule façon de savoir qu'une modification n'a pas ouvert une brèche — et un changement de prompt en ouvre régulièrement.

---

## 10. La prise de rendez-vous : un lien, ou un rappel

**Décision du 25 septembre 2026, qui remplace une conception plus ambitieuse abandonnée le jour même.** L'approche précédente lisait le calendrier de l'agence par API — Google Calendar ou Calendly —, proposait des créneaux dans la conversation et écrivait l'événement. Elle est abandonnée : OAuth par tenant, deux intégrations à maintenir, des jetons qui expirent, et une hypothèse non vérifiée sur l'équipement des agences de Dakar. Trop de produit pour une v1.

### La règle

**Coumba envoie le lien de prise de rendez-vous de l'agence. S'il n'y en a pas, elle annonce un rappel.**

Rien d'autre. Aucune lecture de calendrier, aucune écriture d'événement, aucune authentification à un service tiers. L'agence garde son outil, nous n'y touchons pas.

| Situation | Ce que fait Coumba |
|---|---|
| Un lien est configuré pour cette intention | Elle l'envoie dans la conversation |
| Aucun lien configuré | Elle annonce qu'un conseiller rappelle pour convenir d'un créneau, et elle escalade (§9) |

### Deux liens, parce que ce sont deux métiers

L'agence configure ses liens sur la page de Coumba, dans le tableau de bord.

Par défaut, **un seul champ** : `booking_url`, utilisé pour toutes les demandes.

Une case à cocher — **« Un lien différent pour l'achat »** — ouvre un **second champ**. Le premier devient alors le lien **location**, le second le lien **achat**.

| Champ | Quand | Ce qu'il vise en pratique |
|---|---|---|
| `booking_url_rental` | Toujours (sert à tout si la case est décochée) | Les visites sur place, côté location |
| `booking_url_sale` | Seulement si `split_booking_links` est coché | Les visites en visio, côté achat — l'acheteur diaspora ne peut pas se déplacer |

**La raison de la séparation n'est pas technique, elle est humaine :** dans une agence, la location et la vente ne sont pas suivies par la même personne. Deux liens, deux agendas, deux employés. Un lien unique enverrait un acheteur de Paris dans les créneaux de visite sur place du chargé de location.

### Le routage par intention

Coumba choisit le lien à partir du champ `intent` de la qualification (§2) :

- `location` → `booking_url_rental`
- `achat` et `investissement` → `booking_url_sale` si la case est cochée, `booking_url_rental` sinon
- `à qualifier` → **elle ne devine pas.** Si les liens sont séparés, elle pose la question avant d'envoyer quoi que ce soit ; s'il n'y en a qu'un, elle l'envoie.

**Le lien n'est jamais construit par le modèle.** Il vient d'un outil qui lit la configuration du tenant et renvoie l'adresse telle quelle, ou rien. C'est la même règle qu'au §8 pour le lien d'annonce : deviner une adresse produit des liens morts envoyés à de vrais acheteurs.

### Ce qu'on ne sait pas, et qu'on n'affichera donc pas

**La réservation se passe entièrement chez l'agence.** Nous n'avons aucun retour : ni webhook, ni lecture d'agenda. Conséquences, toutes assumées :

- **On sait qu'un lien a été envoyé. On ne sait pas s'il a été utilisé.** Le §6 revient à deux états — et le troisième état « rendez-vous posé », introduit le matin même quand la lecture d'agenda était prévue, est retiré. La prémisse a disparu avec l'intégration.
- **On ne connaît ni la date ni l'heure d'un rendez-vous.** Donc aucune confirmation, aucun rappel automatique de notre part : `appointment_confirmation` et `appointment_reminder` **sortent de la bibliothèque de templates** (§5). Ce n'est pas une perte — Calendly, Google et les autres envoient déjà leurs propres confirmations et rappels. Les dupliquer ferait recevoir deux messages au prospect, dont un potentiellement faux.
- **La table s'appelle `visit_requests`, pas `appointments`.** Nous n'enregistrons pas des rendez-vous, nous enregistrons des demandes de visite et ce qu'on en a fait. Le nom doit dire la vérité : une table `appointments` remplie de lignes qui ne sont pas des rendez-vous finirait par être lue comme si elle en contenait.

### Le lien et la fenêtre de 24 heures

**Aucun template ne porte de lien** (§5, décision du 25 septembre). Le lien de prise de rendez-vous ne part donc **qu'en message libre, dans la fenêtre de 24 h**.

En pratique c'est le cas normal : la visite se propose au cours d'une conversation vivante. Hors fenêtre, la séquence est celle de tous les autres liens — un template à boutons rouvre la fenêtre, le prospect touche un bouton, le lien part ensuite. `visit_slot` et `visit_slot_followup` ne proposent donc plus un créneau précis : **ils demandent si le prospect veut programmer une visite**, et le lien suit.

### Ce que ça change pour l'argumentaire

La promesse « elle pose le rendez-vous dans votre agenda » n'est plus tenable et ne doit plus être prononcée. Ce qui reste vrai, et qui suffit : **elle qualifie, puis elle oriente vers la prise de rendez-vous sans que personne n'ait à intervenir**. À corriger dans `brief-prospection-agences.md` et dans `contexte-projet.md`.

### Ce qu'on gagne, puisque c'est le but

Aucune intégration à construire ni à maintenir, aucun écran d'autorisation à l'onboarding, aucun jeton qui expire un samedi, et une agence sans outil de réservation reste installable le jour même. Sur la grille Personal MBA, le **coût de délivrance** et la **rapidité de mise sur le marché** s'améliorent tous les deux. Le chemin par API reste écrit ici comme une piste pour plus tard, si des agences le réclament.

---

## 11. Numéros de téléphone

**Affichés en clair partout, et cliquables.** L'agence est responsable de traitement, le numéro est le contact de son propre client, et tout l'intérêt de l'outil est qu'elle puisse l'appeler. Masquer dans son propre dashboard serait du théâtre qui rend le produit inutilisable.

Le seul cas où le masquage se justifie : les captures d'écran destinées à la communication commerciale de Codaya.

**Quand on n'a pas le nom, on affiche le numéro.** Un contact tout neuf ne nous donne que son `wa_id`. Dans les listes comme dans le panneau « En ce moment », le numéro prend la place du nom.

---

## 12. Listes

- **Pagination systématique, 12 éléments par page** — sur les leads, les dossiers, les conversations et les biens.
- **Toute ligne de liste est cliquable** et mène au détail correspondant.
- **Leads** : tri par meilleur score par défaut, bascule date croissante ou décroissante.
- **Conversations** : leads et dossiers réunis, les plus récentes d'abord (l'urgence prime), bascule vers les plus anciennes, filtre par type — toutes / leads / locataires — et deux boutons vers les listes complètes de Coumba et de Malick.
- **Visites** : un clic mène à la conversation qui a produit la visite.
- **Biens** : filtres tous / vente / location / à confirmer. Un bien publié sans lien d'annonce porte une puce rouge.

---

## 13. Navigation et marqueurs de feuille de route

Menu : Tableau de bord · Conversations · Leads · Visites · Dossiers · **Nos biens** · les agents.

**Correction assumée.** « Nos biens » avait d'abord été grisé et marqué « bientôt », pour resserrer la phase 1. C'était une erreur, relevée par Arouna : sans catalogue, Coumba n'a rien à proposer. La fonctionnalité est revenue en phase 1 pleine et entière — voir §8. Un seul élément reste grisé et marqué « bientôt » : **Sokhna**, qui montre que le produit évolue sans qu'on ait à le promettre à l'oral.

Sur mobile et tablette, la navigation passe en tiroir avec voile, fermable au clic sur un élément, sur le voile ou avec Échap. Le panneau « Bonjour / En ce moment » remonte au-dessus du contenu plutôt que de disparaître.

**Les pages de détail gardent leur parent allumé dans le menu** : ouvrir un dossier laisse « Dossiers » en surbrillance, ouvrir le formulaire d'ajout laisse « Nos biens » en surbrillance.

---

## 14. Tableau de bord

Organisé par agent, avec des indicateurs qui couvrent la prospection **et** la maintenance :

- Messages traités · Leads qualifiés (dont X avec un numéro étranger) · Visites proposées · Dossiers résolus (X / Y)
- **Temps de réponse moyen** : courbe à série unique, survol avec repère et infobulle, un seul label direct sur le dernier point. La mesure d'avant installation est une **annotation datée à côté du graphe**, jamais une courbe.
- **Qui a fait quoi** : répartition du volume entre Coumba et Malick
- **Ce qui demande votre attention** : leads chauds et dossiers urgents mélangés, monogramme de l'agent en tête de ligne

---

## 15. Règles de méthode

Elles ne décrivent pas le produit mais la façon de le construire. Elles sont ici parce que chacune vient d'une erreur commise pendant la conception, et qu'elles se reperdront si elles ne sont écrites nulle part.

**Tout patch automatisé doit s'assurer qu'il a bien été appliqué.** Un script de remplacement a un jour cherché une ancre à dix caractères de séparation alors que le fichier en contenait onze. `str.replace` n'a rien fait, le script a affiché « ok », une fonction n'a jamais été insérée, la page a levé une exception au premier rendu et **tous les gestionnaires de clic sont morts d'un coup**. Le symptôme visible — « je ne peux plus cliquer sur les agents » — ne ressemblait en rien à la cause. Règle : `assert ancre in fichier` avant chaque remplacement, et vérification du compte après.

**Un validateur d'enums tourne sur les données, pas seulement sur le schéma.** Deux valeurs hors liste s'étaient glissées dans les services d'un bien, écrites par celui-là même qui venait de rédiger la règle du §2. Une règle non outillée n'est pas une règle.

**Toute vue est vérifiée dans un vrai navigateur avant d'être montrée.** Playwright, parcours complet du menu, ouverture des détails, contrôle qu'aucune erreur JS n'est levée, et un passage en 390 px de large pour le débordement horizontal.

**Ne jamais réécrire un document du projet depuis une copie locale sans l'avoir relu d'abord.** Plusieurs conversations écrivent dans les mêmes documents. Le 25 septembre, la copie locale de l'architecture technique datait du 23 : elle annonçait encore « 3 % d'un abonnement à 300 000 » et vantait le bouton d'URL comme option de palier, deux choses supprimées depuis. L'écraser aurait effacé deux jours de décisions sans que rien ne le signale. Règle : `project_read` d'abord, comparaison ensuite, écriture en dernier.

**Chaque chiffre affiché doit survivre à la question « d'où il sort ? ».** C'est le §1 appliqué au moment d'écrire la ligne de code, pas au moment de la relecture. Trois indicateurs ont été supprimés après cette question : le mode des visites, la comparaison de temps de réponse avant/après, et la mention « depuis l'Europe ».

---

## 16. Design

Système de tokens issu de la synthèse de quatre références Figma : **Hotel London** pour le thème clair, **The Arc** pour le thème sombre, **Luxury Interior** pour le rythme éditorial, **Paperpillar** pour le vocabulaire de composants.

Palette : ivoire chaud en fond, **vert profond** comme couleur structurante (`--brand`, remplacée par la couleur du tenant en co-branding), **ocre** en accent unique, **bleu-gris** en troisième couleur pour Amadou et le catalogue. Typographie : Instrument Serif pour les chiffres et les titres, Inter pour l'interface.

Écart assumé par rapport à Paperpillar : **contraste nettement relevé**. Le pastel d'origine est illisible sur un téléphone en plein jour à Dakar.

Thèmes clair et sombre tous deux définis explicitement, pas par inversion automatique.
