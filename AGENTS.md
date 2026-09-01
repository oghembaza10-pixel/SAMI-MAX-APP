# Les règles de cette maison

Ce fichier est lu par les assistants qui travaillent sur ce dépôt — Cursor,
Claude Code, et les suivants. Lis-le avant de toucher quoi que ce soit.

Ce ne sont pas des préférences de style. Chaque règle vient d'une panne
réelle, en production, qui a coûté du temps ou de la crédibilité devant un
client.

---

## Le contexte en trois phrases

SAMII OS est une plateforme en marque blanche. Un même code sert plusieurs
communautés : la nôtre (`samii`) et celles de partenaires — aujourd'hui
**Le Coin Du Digital** (`coindudigital`), à Douala. Chaque communauté a son
propre service Render, son domaine, ses couleurs, ses modules.

**Une partenaire ne doit jamais voir notre marque, nos modules, nos données.**
C'est la règle qui gouverne tout le reste.

---

## 1. Le domaine décide, pas le compte

La communauté vient de la variable d'environnement `COMMUNAUTE_PAR_DEFAUT`
du service, posée dans `res.locals.COM` par `index.js`. Jamais du compte
connecté, jamais d'un paramètre d'URL.

```js
const COM = res.locals?.COM || communautes.get(communautes.DEFAUT);
```

## 2. La porte

Un middleware unique dans `index.js`, **avant toutes les routes**, ferme
tout chemin qui n'appartient pas aux modules de la communauté
(`config/modules-qg.js`). Une nouvelle route est **fermée par défaut** chez
les partenaires : il faut la déclarer dans `chemins` d'un module pour
l'ouvrir. L'oubli tombe du côté sûr.

**Cacher un bouton n'a jamais fermé une porte.** Et son corollaire, appris
plus tard : **cacher une page sans retirer son lien est pire que de ne rien
cacher** — on clique, on rebondit vers l'accueil, et on ne comprend pas.

## 3. Toute lecture est cloisonnée par communauté

Une table sans filtre est **globale par défaut**. Cette fuite est revenue
cinq fois : le fil, les discussions, le classement, la marketplace, les
vitrines.

```sql
WHERE COALESCE(p.communaute, $defaut) = $slug
```

Le `COALESCE` range les lignes antérieures à la colonne dans la maison —
c'est exact, tout ce qui existait avant a été créé chez nous.

## 4. Les données plutôt que la duplication

Les partenaires, les modules, les paliers, les modèles WhatsApp sont des
**registres** (`config/*.js`), pas du code recopié. Ajouter une partenaire
= ajouter une entrée. Si tu t'apprêtes à copier un fichier en changeant
trois chaînes, arrête-toi.

## 5. L'identité vient de la session, jamais du corps de la requête

Un identifiant accepté depuis la page, et on lit ou on écrit à la place de
quelqu'un d'autre. Ce bug est arrivé **quatre fois** ici : discussions,
actions du fil, publications, messages privés.

---

## Le piège qui a coûté huit fois

**Jamais de backtick dans un commentaire à l'intérieur d'un template
literal.** Beaucoup de pages sont construites avec `res.send(\`…\`)`. Un
backtick dans un commentaire CSS ou JS à l'intérieur ferme le template.
Node signale alors l'erreur **des centaines de lignes plus loin**, sur une
ligne parfaitement innocente.

`tests/gabarits.test.js` compile chaque fichier et chaque vue pour l'attraper.

Deux autres, du même genre :
- **`const` utilisé avant sa déclaration** (TDZ) — trois fois. Ça met la
  page en erreur 500, et seul un rendu réel le voit.
- **Un guillemet double dans un attribut `onclick`** referme l'attribut au
  milieu. Le bouton est mort, silencieusement.

---

## Les tests

```bash
npm test        # 21 suites — à lancer AVANT chaque push
```

Trois règles apprises à la dure :

1. **Tester le comportement, pas le texte du code.** Une requête assemblée
   par `clauses.join(" AND ")` ne montre pas ses filtres dans sa chaîne SQL.
   Un test qui lit la source crie à tort, puis se tait quand ça compte.

2. **Casser le code exprès pour vérifier que le test crie.** Un test qu'on
   n'a jamais vu échouer ne prouve rien. Plusieurs assertions écrites ici
   ne vérifiaient rien du tout — découvert uniquement en les éprouvant.

3. **Les doublures de base de données n'exécutent pas le SQL.** Elles
   prouvent qu'on demande la bonne chose, jamais que la base saurait
   répondre. Une requête invalide y passe sans bruit. Pour en être sûr :
   lancer un vrai Postgres et l'application.

---

## Faire tourner l'application pour de vrai

```bash
npm start       # nécessite DATABASE_URL
```

Pour une vérification locale complète, monter un Postgres jetable, appliquer
le schéma avec `services/schema.js` (`preparer()`), puis démarrer avec
`COMMUNAUTE_PAR_DEFAUT=coindudigital` pour se mettre dans la peau du service
d'une partenaire. Le magasin de sessions **exige SSL** — la base locale doit
l'activer.

---

## Git

| Branche | Rôle |
|---|---|
| `OG.LABO` | **la principale** — c'est elle que déploie la production |
| `partner/coin-du-digital` | le travail sur la communauté d'Inès |

Les deux sont tenues synchronisées. Ne pas confondre avec `main`, qui est un
vieux dépôt sans ancêtre commun — mort.

**Si plusieurs assistants travaillent en même temps :** un seul à la fois sur
un même fichier, ou une branche chacun. Toujours `git pull` avant de
commencer, `npm test` avant de pousser.

---

## Ce qu'on ne fait jamais

- **Coller une clé ou un jeton dans une conversation.** Une clé qui passe
  dans un chat est une clé à changer. Elles vivent dans Render, nulle part
  ailleurs.
- **Une valeur de repli codée en dur sur un identifiant d'expéditeur ou une
  clé.** L'envoi réussit alors depuis un compte que personne n'a choisi, et
  rien ne le signale.
- **Supprimer une variable d'environnement sans vérifier à quoi elle sert.**
  `GOOGLE_API_KEY` sert au Custom Search et à YouTube, pas à Gemini.
- **Écrire dans les commentaires ce qu'on aimerait avoir fait.** Les
  commentaires de ce dépôt racontent *pourquoi* le code est ainsi et *ce qui
  a cassé* avant. Ils doivent rester vrais.
