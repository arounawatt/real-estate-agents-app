# Installer une nouvelle agence

Procédure manuelle, en attendant l'Embedded Signup (voir `docs/architecture-technique-saas.md`, « Branchement d'un nouveau client ») : l'agence cliquera un jour un bouton dans le tableau de bord, mais il faut d'abord l'App Review et la vérification commerciale de Meta.

## 0. Avant de démarrer : pas de vraie agence sur l'app de dev

L'app Meta n'a **qu'une URL de webhook** pour tous les WABA qui y sont abonnés. Celle de dev pointe sur le tunnel ngrok d'un poste : une agence branchée dessus ne reçoit de réponse que quand ce poste tourne, et ses messages atterrissent dans la base de dev.

Une agence qui paie demande donc **un worker déployé et une app Meta de prod distincte**, avec ses propres `META_APP_SECRET` et `META_WEBHOOK_VERIFY_TOKEN`.

Vérifier aussi que l'entreprise est **vérifiée chez Meta** : sans vérification, le nombre de numéros et le volume d'envoi sont bridés.

## 1. Côté Meta : le numéro et le WABA

1. **Un numéro dédié à l'agent**, jamais le WhatsApp principal de l'agence. Un numéro raccordé à la Cloud API cesse de fonctionner dans l'application WhatsApp du téléphone : l'équipe le perdrait. Il faut une SIM qui reçoit SMS ou appel, et qui n'est pas déjà active sur WhatsApp.
2. **Créer le WABA** dans notre Business Manager (WhatsApp Manager → ajouter un numéro), saisir le code de vérification, renseigner le nom affiché (celui de l'agence).
3. **L'attribuer à l'utilisateur système** (Paramètres Business → Utilisateurs système → Attribuer des ressources → Comptes WhatsApp, contrôle total). Le jeton de cet utilisateur couvre alors le nouveau numéro, sans en générer un autre.
4. **Ajouter un moyen de paiement** sur le WABA : les conversations payantes nous sont facturées, à refacturer à l'agence.
5. Relever le **WABA ID** et le **phone number ID** (WhatsApp Manager, ou la page « API Setup » de l'app).

Le numéro nous appartient tant qu'il est dans notre Business Manager. Si l'agence veut le reprendre, ou au passage à l'Embedded Signup, il faudra le migrer.

Le jeton : un jeton d'**utilisateur système** (n'expire jamais). Jamais celui de la page « API Setup », qui expire au bout de 24 h. Il se transmet dans le fichier JSON ci-dessous, jamais par messagerie.

## 2. Créer l'agence

1. Copier `exemple.json` sous un nouveau nom, par exemple `keur-immo.json`, dans ce dossier.
2. Le remplir (voir les champs ci-dessous).
3. Lancer, depuis la racine du projet :

   ```
   pnpm ops:onboard keur-immo.json
   ```

Le script vérifie tout avant d'écrire (format, numéros déjà utilisés, jeton auprès de Meta), puis crée l'agence, ses numéros et son WhatsApp en une seule fois : tout ou rien. Il affiche le `tenant_id` et un **mot de passe provisoire** par compte, à transmettre à l'agence (à changer dans « Mes paramètres »).

**Après coup, retirer le jeton Meta du fichier** : il est enregistré chiffré en base, il n'a plus rien à faire ici en clair. Ce dossier est exclu de Git, sauf ce mode d'emploi et l'exemple.

## 3. Après le script

- **Les templates** : aucun script pour l'instant, à créer à la main dans le WhatsApp Manager du nouveau WABA, puis à faire approuver. Sans eux, l'agent répond à qui lui écrit, mais ne peut relancer personne au-delà de 24 h.
- **Le catalogue** : sans biens, Coumba n'a rien à proposer. Import, saisie dans le tableau de bord, ou lecture des annonces du site par Amadou (`listingDomains`). C'est souvent l'étape la plus longue.
- **Tester** en écrivant au numéro de l'agent depuis un téléphone qui n'est **ni admin ni locataire** de l'agence : c'est le seul cas où l'on parle à Coumba.
- **Transmettre** à l'agence l'adresse du tableau de bord et les mots de passe provisoires.

## Les champs

`agency` — l'agence. Tout est modifiable ensuite dans « Mes paramètres », sauf le plan et les deux derniers champs.

| Champ | Valeur |
|---|---|
| `name` | Nom de l'agence, cité par Coumba. Facultatif : sans nom, elle dit « l'agence ». |
| `plan` | `essential` ou `complete` (Malick n'est actif qu'en `complete`). |
| `listingDomains` | Domaines du site de l'agence, ceux dont Amadou peut lire les annonces. |
| `bookingUrlRental` | Lien de prise de rendez-vous (Calendly ou autre). Sert à tout si `splitBookingLinks` est `false`. |
| `bookingUrlSale` | Lien pour les ventes, utilisé seulement si `splitBookingLinks` est `true`. |
| `disclosureLevel` | `neighbourhood` (Coumba situe le quartier par des faits) ou `listing_only` (elle s'en tient aux annonces). |
| `emergencyNumbers` | Numéros d'urgence donnés par Malick en cas de danger : `[{ "label": "Pompiers", "number": "…" }]`. **À obtenir de l'agence, ne pas les deviner.** |

`admins` — au moins un numéro, au format international (`+221 …`, `+33 …`).
`dashboardAccess: false` = numéro admin WhatsApp sans compte sur le tableau de bord.
⚠ Un numéro admin ne parle plus à Coumba : ne pas y mettre un numéro qui sert à tester l'agent commercial.

`whatsapp` — facultatif (raccordable plus tard avec `pnpm ops:whatsapp`). Les trois valeurs viennent du Meta Business Manager de l'agence.

## Les scripts unitaires

```
pnpm ops:tenant --phone "+221 77 123 45 67" --name "Keur Immo" --plan essential
pnpm ops:user --tenant <tenant_id> --phone "+221 77 123 45 67" --name "Awa Diop"
pnpm ops:user --tenant <tenant_id> --phone "+33 6 12 34 56 78" --no-access
pnpm ops:whatsapp --tenant <tenant_id> --waba-id <id> --phone-number-id <id>
```

`ops:user` sert aussi à **réinitialiser un mot de passe** ou débloquer un compte.

**Jeton WhatsApp expiré** (Coumba ne répond plus) : `pnpm ops:whatsapp-token`, qui liste les numéros raccordés et demande lequel mettre à jour. Les mots de passe et le jeton Meta sont demandés au clavier, jamais en argument.

Pas encore automatisé : l'envoi de la bibliothèque de templates sur le WABA de l'agence.
