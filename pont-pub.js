/* Wikigacha — pont publicitaire.

   Ce fichier est le SEUL endroit du projet qui connaît une régie. Le jeu, lui,
   ne sait qu'appeler window.WikigachaAds. Chargé sur le web ouvert ou dans une
   TWA, il ne fait rien : il n'y a pas de plugin Capacitor, donc pas de pont,
   donc pas de publicité — et le jeu continue exactement comme avant.

   Contrat attendu par le jeu :
     WikigachaAds.interstitiel()  -> Promise, résolue quoi qu'il arrive
     WikigachaAds.recompense()    -> Promise<bool>, vrai si la récompense
                                     a réellement été gagnée

   À FAIRE avant publication : remplacer les deux identifiants ci-dessous par
   ceux de votre console AdMob, et passer TEST à false. */

(function () {
  'use strict';

  var ID_INTERSTITIEL = 'ca-app-pub-3940256099942544/1033173712'; /* bloc de test Google */
  var ID_RECOMPENSE   = 'ca-app-pub-3940256099942544/5224354917'; /* bloc de test Google */
  var TEST = true;   /* passer à false avec vos vrais identifiants */

  var AdMob = window.Capacitor
           && window.Capacitor.Plugins
           && window.Capacitor.Plugins.AdMob;
  if (!AdMob) return;   /* web ouvert ou TWA : aucun pont */

  var pret = false;

  /* Initialisation, puis consentement. Dans l'EEE, le consentement doit être
     recueilli AVANT la première publicité : c'est une obligation, pas une
     option, et AdMob coupe la diffusion si le message n'est pas configuré
     dans la console. */
  var demarrage = Promise.resolve()
    .then(function () {
      return AdMob.initialize({ initializeForTesting: TEST });
    })
    .then(function () {
      if (typeof AdMob.requestConsentInfo !== 'function') return null;
      return AdMob.requestConsentInfo().then(function (info) {
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') {
          return AdMob.showConsentForm();
        }
        return null;
      });
    })
    .then(function () { pret = true; })
    ['catch'](function () { pret = false; });

  function interstitiel() {
    return demarrage.then(function () {
      if (!pret) return;
      return AdMob.prepareInterstitial({ adId: ID_INTERSTITIEL, isTesting: TEST })
        .then(function () { return AdMob.showInterstitial(); })
        /* Pas d'inventaire, réseau coupé, erreur de bloc : on ne bloque
           jamais le joueur pour une publicité qui n'arrive pas. */
        ['catch'](function () {});
    })['catch'](function () {});
  }

  function recompense() {
    return demarrage.then(function () {
      if (!pret) return false;
      return AdMob.prepareRewardVideoAd({ adId: ID_RECOMPENSE, isTesting: TEST })
        .then(function () { return AdMob.showRewardVideoAd(); })
        /* La promesse ne se résout qu'une fois la récompense gagnée : si le
           joueur ferme avant la fin, on rejette et il n'a rien. */
        .then(function (item) { return !!item; })
        ['catch'](function () { return false; });
    })['catch'](function () { return false; });
  }

  window.WikigachaAds = { interstitiel: interstitiel, recompense: recompense };
})();
