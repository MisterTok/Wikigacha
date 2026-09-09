# Plus tard

Idées et chantiers repoussés **après** la première publication sur le Play Store.

Règle du moment : le code est gelé jusqu'au premier envoi de l'AAB.
Toute idée qui arrive d'ici là s'écrit ici et ne se code pas. Rien n'est perdu :
une mise à jour sur la piste de test fermé ne remet pas les 14 jours à zéro.

---

## Décidé, à faire après la publication

### Classement en ligne
Aujourd'hui la cote Elo vit dans le `localStorage` : personne ne peut se comparer.
La cote est déjà préparée pour ça (entier, borné entre 0 et 5000, réparé au
chargement), donc elle pourra être envoyée telle quelle sans remise à zéro des
joueurs de la première version.

Deux voies :
- **Play Games Services** — hébergé par Google, aucun serveur à tenir, apporte
  au passage la connexion au compte Google et les succès synchronisés. Le bon
  choix par défaut.
- **Backend perso** (Supabase, Firebase) — plus souple, mais authentification,
  règles d'écriture et surtout triche à gérer : tout est calculé côté client,
  donc une cote qui arrive du téléphone est falsifiable.

### Seuil Mythique à réajuster
Le plafond d'audience est passé de 30 000 à 20 000 vues sur deux mois.
Estimation : la Mythique passe d'environ 1 carte sur 1000 à 1 sur 300-400.
À surveiller pendant le test fermé : si les testeurs en signalent trop,
remonter à 25 000. C'est un seul chiffre à changer, dans `PLAFONDS_VUES`.

### Garantie de paquet — à observer
La garantie Épique ne pouvait pas être tenue quand Wikipédia ne sortait pas
d'article assez bon dans le délai : elle est maintenant reportée au paquet
suivant, et le bandeau l'affiche. Vérifier pendant le test que le report se
déclenche rarement — s'il est fréquent, c'est que le délai de recherche
(6 secondes) est trop court.

---

## À trancher

### Acheter des Wikigold avec de l'argent réel
Techniquement simple, mais trois conséquences :
- Produit **consommable** (il faut appeler `consume` après avoir crédité),
  alors que premium et sans-pub sont des non consommables. Deux logiques à
  faire cohabiter dans `pont-achats.js`.
- Fait entrer le jeu dans le **régime des loot boxes** : argent réel → or →
  paquets → cartes aléatoires. Obligation d'afficher les probabilités par
  rareté avant l'achat, déclaration dans le classement de contenu, règles
  supplémentaires dans certains pays.
- **Fragile sans serveur** : un non consommable est restauré par Google après
  réinstallation, un solde d'or dans le `localStorage` disparaît. Demandes de
  remboursement impossibles à arbitrer.

Alternative qui évite les deux derniers points : vendre du **déterministe** —
des paquets directement, une carte précise, un dos de carte, un album à
débloquer. Le joueur dépense, tout reste restaurable, et le jeu reste hors du
régime aléatoire.

---

## Idées en vrac

<!-- Ajouter ici tout ce qui vient, sans se juger. Une ligne suffit. -->

-
