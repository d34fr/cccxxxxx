# Discord Mod Bot — Rôle-only Mute

## ⚙️ Installation
1. Installe Node 18+.
2. `npm i`
3. Configure `config.json` avec ton token Discord et tes IDs utilisateur.
4. `npm start` pour lancer le bot (les commandes sont automatiquement déployées).

## 🔑 Permissions requises pour le bot
- Read Messages/View Channels
- Send Messages
- Embed Links
- Manage Roles

Le **rôle du bot** doit être **au-dessus** du rôle Muted.

## 🗃️ Base de données JSON
La base est créée dans `./data/database.json`. Pas besoin de config.

## 🧭 Commandes clés
- `/config logs <channel>` — définir le salon de logs.
- `/configmute role <role>` — définir/remplacer le rôle Muted (OwnerMute/SYS+).
- `/ownermute [user]` — liste ou toggle OwnerMute (SYS+).
- `/gestion ...` — rôles Gestion.
- `/config staff ...` — rôles Staff.
- `/warn`, `/mute`, `/unmute`, `/unmuteall`
- `/sanction`, `/delsanction`, `/delallsanction`

Voir le code pour tous les détails et validations.
