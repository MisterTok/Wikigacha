/* Wikigacha — pont d'achats pour l'enveloppe Capacitor.

   Pourquoi ce fichier : l'API Digital Goods du navigateur n'existe QUE dans
   une TWA. Dès qu'on passe à Capacitor pour avoir AdMob, elle disparaît, et
   avec elle tous les achats. Le jeu appelle donc window.WikigachaAchats quand
   il existe, et retombe sur Digital Goods sinon. Une seule base de code, deux
   enveloppes.

   Contrat attendu par le jeu :
     WikigachaAchats.lister()        -> Promise<[{itemId}]>  achats actifs
     WikigachaAchats.acheter(sku)    -> Promise<bool>        vrai si abouti
     WikigachaAchats.prix([sku...])  -> Promise<[{itemId, price:{value,currency}}]>

   ---------------------------------------------------------------------------
   GREFFON : @capgo/native-purchases

     npm install @capgo/native-purchases
     npx cap sync

   Choisi parce qu'il parle directement a Google Play Billing, sans service
   tiers ni serveur intermediaire — ce qui correspond au reste du jeu, qui
   n'a pas de backend. Il s'enregistre sous Capacitor.Plugins.NativePurchases.
   ---------------------------------------------------------------------------

   DEUX NATURES DE PRODUIT, ET C'EST VOULU :

     wikigacha_sans_pub   achat UNIQUE   ('inapp')
        Paye une fois, acquis pour toujours. La publicite disparait.

     wikigacha_premium    ABONNEMENT     ('subs')
        Se renouvelle, et peut cesser. Il faut donc le REVERIFIER a chaque
        lancement : lister() fait foi, jamais une valeur gardee sur
        l'appareil. Le jeu reconstruit son etat a partir de cette liste, donc
        un abonnement resilie ou impaye retire ses avantages tout seul.

   Play ne melange pas les deux : getPurchases et getProducts veulent savoir
   de quel type on parle. On interroge donc les deux et on fusionne.         */

(function () {
  'use strict';

  var Facturation = window.Capacitor
                 && window.Capacitor.Plugins
                 && window.Capacitor.Plugins.NativePurchases;
  if (!Facturation) return;   /* pont absent : le jeu utilise Digital Goods */

  var INAPP = 'inapp';   /* achat unique */
  var SUBS  = 'subs';    /* abonnement */

  /* La seule liste a tenir a jour si un produit change de nature un jour. */
  var ABONNEMENTS = ['wikigacha_premium'];

  function typeDe(sku) {
    return ABONNEMENTS.indexOf(sku) !== -1 ? SUBS : INAPP;
  }

  /* Play met parfois plusieurs secondes a repondre au premier appel, et il
     arrive qu'il ne reponde pas du tout (Play Store en cours de mise a jour,
     appareil sans Play Services). On ne laisse jamais le jeu attendre
     indefiniment : passe le delai, on rend une valeur de repli. */
  function avecDelai(promesse, ms, repli) {
    return new Promise(function (resolve) {
      var fini = false;
      var t = setTimeout(function () {
        if (!fini) { fini = true; resolve(repli); }
      }, ms);
      promesse.then(function (v) {
        if (!fini) { fini = true; clearTimeout(t); resolve(v); }
      })['catch'](function () {
        if (!fini) { fini = true; clearTimeout(t); resolve(repli); }
      });
    });
  }

  /* Un achat non acquitte sous 72 heures est REMBOURSE AUTOMATIQUEMENT par
     Google, et le joueur perd ce qu'il a paye. Vrai pour un achat unique
     comme pour chaque echeance d'un abonnement. Le greffon acquitte seul,
     mais on repasse derriere : un achat reste en suspens (application fermee
     au mauvais moment, plantage juste apres le paiement) est rattrape au
     demarrage suivant. L'appel est sans effet sur un achat deja acquitte. */
  function rattraperAcquittements(achats) {
    if (typeof Facturation.acknowledgePurchase !== 'function') return;
    achats.forEach(function (a) {
      if (a && a.transactionId) {
        Facturation.acknowledgePurchase({
          transactionId: a.transactionId,
          productId: a.productIdentifier
        })['catch'](function () {});
      }
    });
  }

  window.WikigachaAchats = {

    /* Ce que le joueur possede A CET INSTANT. Appele au lancement : c'est la
       seule source de verite. Un achat unique y figure toujours ; un
       abonnement n'y figure QUE tant qu'il est actif. */
    lister: function () {
      var vide = { purchases: [] };
      return Promise.all([
        avecDelai(Facturation.getPurchases({ productType: INAPP }), 8000, vide),
        avecDelai(Facturation.getPurchases({ productType: SUBS  }), 8000, vide)
      ]).then(function (r) {
        var achats = [];
        r.forEach(function (x) {
          if (x && x.purchases) achats = achats.concat(x.purchases);
        });
        rattraperAcquittements(achats);
        return achats
          .filter(function (a) { return a && a.productIdentifier; })
          .map(function (a) { return { itemId: a.productIdentifier }; });
      })['catch'](function () { return []; });
    },

    /* Lance le tunnel de paiement de Google Play. La promesse ne se resout a
       vrai que si la transaction aboutit vraiment : un joueur qui ferme la
       feuille de paiement, ou dont la carte est refusee, ne debloque rien.
       Le type est deduit du sku — se tromper ferait echouer Play. */
    acheter: function (sku) {
      return Facturation.purchaseProduct({
        productIdentifier: sku,
        productType: typeDe(sku)
      }).then(function (t) {
        /* Selon les versions, le greffon renvoie la transaction directement
           ou enveloppee. On accepte les deux, et on verifie que c'est bien
           NOTRE produit qui a ete achete. */
        var tr = (t && t.transaction) ? t.transaction : t;
        if (!tr || !tr.transactionId) return false;
        if (tr.productIdentifier && tr.productIdentifier !== sku) return false;
        rattraperAcquittements([tr]);
        return true;
      })['catch'](function () {
        /* Annulation, paiement refuse, produit introuvable : dans tous les
           cas le jeu ne debloque rien, et surtout ne plante pas. */
        return false;
      });
    },

    /* Prix affiches dans la boutique. On renvoie la valeur ET la devise
       telles que Play les donne, pour que le joueur voie le prix de SON
       pays — jamais un prix code en dur. Les deux types sont demandes
       separement, puis fusionnes. */
    prix: function (skus) {
      var uniques = [], abos = [];
      (skus || []).forEach(function (s) {
        (typeDe(s) === SUBS ? abos : uniques).push(s);
      });
      var vide = { products: [] };

      function demander(liste, type) {
        if (!liste.length) return Promise.resolve(vide);
        return avecDelai(Facturation.getProducts(
          { productIdentifiers: liste, productType: type }), 8000, vide);
      }

      return Promise.all([
        demander(uniques, INAPP),
        demander(abos, SUBS)
      ]).then(function (r) {
        var out = [];
        r.forEach(function (x) {
          ((x && x.products) || []).forEach(function (p) {
            out.push({
              itemId: p.identifier,
              price: { value: p.price, currency: p.currencyCode },
              /* Play fournit aussi le prix deja formate et localise : si le
                 jeu sait l'utiliser un jour, il est la. */
              priceString: p.priceString
            });
          });
        });
        return out;
      })['catch'](function () { return []; });
    }
  };
})();
