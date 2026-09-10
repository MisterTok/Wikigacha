/* Wikigacha — pont d'achats pour l'enveloppe Capacitor.

   Pourquoi ce fichier : l'API Digital Goods du navigateur n'existe QUE dans
   une TWA. Dès qu'on passe à Capacitor pour avoir AdMob, elle disparaît, et
   avec elle tous les achats. Le jeu appelle donc window.WikigachaAchats quand
   il existe, et retombe sur Digital Goods sinon. Une seule base de code, deux
   enveloppes.

   Contrat attendu par le jeu :
     WikigachaAchats.lister()        -> Promise<[{itemId}]>  achats possédés
     WikigachaAchats.acheter(sku)    -> Promise<bool>        vrai si abouti
     WikigachaAchats.prix([sku...])  -> Promise<[{itemId, price:{value,currency}}]>

   ---------------------------------------------------------------------------
   GREFFON : @capgo/native-purchases

     npm install @capgo/native-purchases
     npx cap sync

   Choisi parce qu'il parle directement à Google Play Billing, sans service
   tiers ni serveur intermédiaire — ce qui correspond au reste du jeu, qui
   n'a pas de backend. Il s'enregistre sous Capacitor.Plugins.NativePurchases.

   Nos trois produits sont des produits UNIQUES (non consommables), pas des
   abonnements : on interroge donc toujours Play avec le type 'inapp'.
   ---------------------------------------------------------------------------

   Identifiants déclarés dans la Play Console :
     wikigacha_sans_pub · wikigacha_premium · wikigacha_premium_maj           */

(function () {
  'use strict';

  var Facturation = window.Capacitor
                 && window.Capacitor.Plugins
                 && window.Capacitor.Plugins.NativePurchases;
  if (!Facturation) return;   /* pont absent : le jeu utilise Digital Goods */

  var INAPP = 'inapp';        /* produits uniques, jamais 'subs' */

  /* Play met parfois plusieurs secondes à répondre au premier appel, et il
     arrive qu'il ne réponde pas du tout (Play Store en cours de mise à jour,
     appareil sans Play Services). On ne laisse jamais le jeu attendre
     indéfiniment : passé le délai, on rend une valeur de repli. */
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

  /* Un achat non acquitté sous 72 heures est REMBOURSÉ AUTOMATIQUEMENT par
     Google, et le joueur perd ce qu'il a payé. Le greffon acquitte tout seul
     par défaut, mais on repasse derrière : si un achat traîne non acquitté
     (application fermée au mauvais moment, plantage juste après le paiement),
     on le rattrape au démarrage suivant. L'appel est idempotent, le relancer
     sur un achat déjà acquitté est sans effet. */
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

    /* Ce que le joueur possède déjà. Appelé au lancement pour restaurer le
       premium après une réinstallation ou un changement de téléphone : c'est
       Google qui garde la trace de l'achat, pas nous. */
    lister: function () {
      return avecDelai(
        Facturation.getPurchases({ productType: INAPP }),
        8000,
        { purchases: [] }
      ).then(function (r) {
        var achats = (r && r.purchases) || [];
        rattraperAcquittements(achats);
        return achats
          .filter(function (a) { return a && a.productIdentifier; })
          .map(function (a) { return { itemId: a.productIdentifier }; });
      })['catch'](function () { return []; });
    },

    /* Lance le tunnel de paiement de Google Play. La promesse ne se résout à
       vrai que si la transaction est réellement aboutie : un joueur qui ferme
       la feuille de paiement, ou dont la carte est refusée, ne débloque
       rien. */
    acheter: function (sku) {
      return Facturation.purchaseProduct({
        productIdentifier: sku,
        productType: INAPP
      }).then(function (t) {
        /* Selon les versions, le greffon renvoie la transaction directement ou
           enveloppée. On accepte les deux, et on vérifie que c'est bien NOTRE
           produit qui a été acheté. */
        var tr = (t && t.transaction) ? t.transaction : t;
        if (!tr || !tr.transactionId) return false;
        if (tr.productIdentifier && tr.productIdentifier !== sku) return false;
        rattraperAcquittements([tr]);
        return true;
      })['catch'](function () {
        /* Annulation par le joueur, paiement refusé, produit introuvable :
           dans tous les cas le jeu ne doit rien débloquer, et surtout ne pas
           planter. */
        return false;
      });
    },

    /* Prix affichés dans la boutique. On renvoie la valeur ET la devise telles
       que Play les donne, pour que le joueur voie le prix de SON pays — jamais
       un prix codé en dur. */
    prix: function (skus) {
      return avecDelai(
        Facturation.getProducts({ productIdentifiers: skus, productType: INAPP }),
        8000,
        { products: [] }
      ).then(function (r) {
        return ((r && r.products) || []).map(function (p) {
          return {
            itemId: p.identifier,
            price: { value: p.price, currency: p.currencyCode },
            /* Play fournit aussi le prix déjà formaté et localisé : si le jeu
               sait l'utiliser un jour, il est là. */
            priceString: p.priceString
          };
        });
      })['catch'](function () { return []; });
    }
  };
})();
