/* Wikigacha — pont d'achats pour l'enveloppe Capacitor.  MODÈLE À COMPLÉTER.

   Pourquoi ce fichier : l'API Digital Goods du navigateur n'existe QUE dans
   une TWA. Dès qu'on passe à Capacitor pour avoir AdMob, elle disparaît, et
   avec elle tous les achats. Le jeu appelle donc window.WikigachaAchats quand
   il existe, et retombe sur Digital Goods sinon. Une seule base de code, deux
   enveloppes.

   Contrat attendu par le jeu :
     WikigachaAchats.lister()        -> Promise<[{itemId}]>  achats possédés
     WikigachaAchats.acheter(sku)    -> Promise<bool>        vrai si abouti
     WikigachaAchats.prix([sku...])  -> Promise<[{itemId, price:{value,currency}}]>

   À FAIRE : choisir un greffon de facturation Capacitor et remplir les trois
   fonctions ci-dessous. Les identifiants de produits sont ceux déclarés dans
   la Play Console :
     wikigacha_sans_pub · wikigacha_premium · wikigacha_premium_maj

   Rappel : un produit unique est acquitté par Play tout seul, mais si votre
   greffon expose acknowledge(), appelez-le — un achat non acquitté est
   remboursé au bout de 72 heures. */

(function () {
  'use strict';

  var Facturation = window.Capacitor
                 && window.Capacitor.Plugins
                 && window.Capacitor.Plugins.VOTRE_GREFFON;
  if (!Facturation) return;   /* pont absent : le jeu utilise Digital Goods */

  window.WikigachaAchats = {
    lister: function () {
      /* return Facturation.getPurchases().then(function (r) {
           return (r.purchases || []).map(function (p) {
             return { itemId: p.productId };
           });
         }); */
      return Promise.resolve([]);
    },

    acheter: function (sku) {
      /* return Facturation.purchase({ productId: sku })
           .then(function (r) { return r && r.state === 'PURCHASED'; })
           ['catch'](function () { return false; }); */
      return Promise.resolve(false);
    },

    prix: function (skus) {
      /* return Facturation.getProducts({ productIds: skus })
           .then(function (r) {
             return (r.products || []).map(function (p) {
               return { itemId: p.productId,
                        price: { value: p.priceAmount, currency: p.priceCurrency } };
             });
           }); */
      return Promise.resolve([]);
    }
  };
})();
