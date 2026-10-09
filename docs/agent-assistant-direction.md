# Adja — l'assistante de direction

*Conçue le 25 septembre 2026. **Pas construite.** Ce document existe pour deux raisons : garder la conception au chaud, et surtout lister ce qu'il faut préparer dans le code dès maintenant pour qu'elle coûte presque rien à ajouter plus tard.*

*« Adja » est un nom provisoire — les trois agents livrés s'appellent Coumba, Malick et Amadou, la prospectrice à venir Sokhna.*

---

## L'idée

Un quatrième agent dont **l'utilisateur est le dirigeant de l'agence**, pas son client. Il fait deux choses :

**Il pousse.** Tous les X jours, à une fréquence réglée par l'agence, il envoie sur WhatsApp un point d'activité complet — ce qui a été traité, les leads qui méritent un appel, les dossiers ouverts, ce qui traîne.

**Il répond.** Le dirigeant lui écrit comme à un collaborateur et lui demande ce qu'il veut sur son affaire : *combien de leads en attente de réponse ? est-ce qu'on a des dossiers locataires urgents ? qui n'a pas été rappelé cette semaine ? qu'est-ce qui bouge sur la villa des Almadies ?* Il répond depuis les données réelles, et **donne le lien direct vers le lead ou le dossier** dans le tableau de bord.

## Ce qui change tout : c'est le premier agent qui parle au client, pas au client du client

Coumba parle à des acheteurs, Malick à des locataires, Amadou à personne. Adja parle au patron — et cette inversion déplace tous les risques.

**Ce qui disparaît.** Aucun engagement envers un tiers n'est possible : elle ne négocie rien, ne promet rien à personne. Les interdictions du §9 sur les prix, les disponibilités et les dossiers ne la concernent pas de la même manière. Aucun template marketing, aucun bouton de retrait, aucune limite par utilisateur.

**Ce qui apparaît, et c'est plus grave.** Elle a **accès à toutes les données d'un tenant**. Deux règles non négociables en découlent.

**La frontière de tenant ne se franchit jamais.** Un dirigeant ne doit pas pouvoir obtenir la moindre information sur une autre agence, ni par une question directe, ni par une formulation détournée, ni par accident. Le `tenant_id` est injecté par le code à partir du numéro qui écrit, **jamais** déduit de ce que dit le message.

**Le modèle n'écrit pas de requête.** Aucune génération de SQL, aucun langage de requête exposé. Elle appelle des **outils bornés à paramètres fermés** — `list_open_tickets(status, urgency)`, `list_hot_leads(min_score, since)`, `count_awaiting_reply()`, `get_property_activity(property_id)` — dont chacun filtre par `tenant_id` côté serveur. C'est la même discipline qu'au §2 pour les enums : ce qui n'est pas dans la liste n'existe pas.

**Un troisième risque, plus discret.** Elle ne doit pas aider le dirigeant à trier illégalement. « Sors-moi les candidats par origine » reste un refus, exactement comme au §9 : la règle ne dépend pas de qui pose la question.

## Comment elle sait que c'est le patron

Le numéro WhatsApp du dirigeant est déclaré à l'onboarding et rattaché à un utilisateur du tableau de bord. Le routage par identité du contact, déjà en place, gagne une troisième branche :

| Le numéro qui écrit | Profil |
|---|---|
| Figure dans `agency_users` | `assistant` — Adja |
| Est un locataire connu | `property_manager` — Malick |
| Est inconnu | `sales` — Coumba |

**Lecture seule dans un premier temps.** Elle ne clôt pas un dossier, ne dépublie pas un bien, n'envoie aucun message à un client à la place du patron. Une action déclenchée par un message mal interprété serait irréversible côté client final, et la première fois que ça arrive le produit est mort. Les actions viendront plus tard, avec confirmation explicite.

## Le rapport et la fenêtre de 24 heures

Un rapport poussé tous les X jours tombe presque toujours **hors** de la fenêtre de 24 h. Or aucun template ne porte de lien, et un template ne peut pas contenir un rapport long et variable (§5).

La séquence est donc celle de tous les autres liens du produit :

1. Un template `assistant_digest_ready`, catégorie `utility`, annonce que le point est prêt — *« Bonjour {{first_name}}, votre point d'activité est prêt. Je vous l'envoie ? »* avec les boutons **Envoyez-le · Plus tard**.
2. Le tap rouvre la fenêtre de 24 h.
3. Le rapport complet et les liens profonds partent **en message libre**, sans contrainte.

Et comme le dirigeant écrira souvent de lui-même — un simple « topo » suffit à ouvrir la fenêtre —, une bonne partie des rapports partiront gratuitement, en message de service.

## Les liens profonds, et le piège qui va avec

Elle donne des liens vers le tableau de bord : `/leads/l1`, `/tickets/248`. Ces liens sont sur notre domaine, donc aucune question de domaine tiers.

**Mais un lien envoyé sur WhatsApp qui ouvre la fiche d'un client ne doit jamais être un lien public devinable.** Il ouvre le tableau de bord, qui exige une session ; à défaut, un jeton court, à usage unique et expirant. Sans ça, un lien transféré dans une conversation de groupe devient une fuite de données personnelles — et c'est l'agence qui en est responsable au sens de la loi.

## Ce qu'il faut préparer dès maintenant, même sans la construire

C'est la raison d'être de ce document. Trois décisions à prendre dans le code de la première version, sans quoi Adja coûtera cher à ajouter.

**`agency_users` dès le départ, avec le numéro WhatsApp et le rôle.** Le routage par identité du contact doit avoir trois branches depuis le premier jour, même si la troisième ne fait rien. Rajouter une branche dans un routeur déjà en production est un chantier ; la prévoir vide ne coûte rien.

**Les requêtes de lecture écrites comme des fonctions de service partagées.** « Les dossiers ouverts », « les leads en attente de réponse », « ce qui n'a pas été rappelé » — le tableau de bord a besoin exactement des mêmes. Si ces requêtes sont écrites dans `packages/db` comme des fonctions bornées par `tenant_id`, et non éparpillées dans les composants Next.js, **les outils d'Adja seront presque gratuits** : ce sont les mêmes fonctions, exposées au modèle. Si elles sont écrites dans les pages, tout sera à réécrire.

**Des URL de détail réelles, pas un routage en mémoire.** La maquette est une page unique qui bascule des vues en JavaScript — il n'y a pas d'adresse pour un lead donné. L'application, elle, doit avoir `/leads/:id` et `/tickets/:id` dès le départ. Sans URL stable, aucun lien profond n'est possible, et c'est la moitié de l'intérêt d'Adja.

## Ce que ça vaut

**Elle répond à la question ouverte n° 5 de `modele-economique.md`** — « le futur troisième palier, s'il en faut un ». C'est le meilleur candidat identifié à ce jour : une vraie valeur pour une agence établie, un coût de construction modéré parce qu'elle réutilise des données déjà là, et aucune intégration externe.

Sur la grille Personal MBA, elle relève le **potentiel d'upsell**, aujourd'hui plafonné à 200 000 FCFA faute de troisième offre. Elle améliore aussi la **fidélité**, qui n'est pas un critère de la grille mais devrait l'être ici : un dirigeant qui reçoit un point d'activité chaque semaine voit ce qu'il paie, et ne résilie pas au troisième mois.

Elle pèse en revanche sur le **coût de délivrance** — un profil de plus à maintenir et à tester — et sur le **coût variable d'API**, puisque le dirigeant pose des questions librement. Le volume reste faible : quelques dizaines de messages par mois contre plusieurs centaines pour Coumba.

**Un placement à trancher au moment de la construire** : troisième palier à part, ou inclus dans le Complet pour le rendre évident. Rien n'est décidé, et il ne faut surtout pas la promettre en rendez-vous avant qu'elle existe — même règle que pour Sokhna.

## Ce qui n'est pas tranché

- Le nom.
- La fréquence par défaut du rapport, et si elle se règle par l'agence ou par nous.
- Le placement commercial.
- Si le rapport doit aussi partir par courriel, pour les dirigeants qui ne vivent pas sur WhatsApp.
- Si plusieurs personnes de l'agence peuvent lui parler, ou seulement le dirigeant — et dans ce cas, si chacune voit tout.
