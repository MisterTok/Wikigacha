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

  /* ------------------------------------------------------------------
     TROIS RÉGLAGES, et il ne faut pas les confondre.

     ID_INTERSTITIEL / ID_RECOMPENSE
       Vos blocs, copiés depuis la console AdMob. Ceux qui sont là sont les
       blocs de démonstration de Google : ils se remplissent toujours, ne
       rapportent rien, et ne présentent aucun risque.

     TEST
       true  = TOUT LE MONDE voit des annonces de test. À garder pendant le
               développement et pendant le test fermé avec vos testeurs.
       false = les vraies annonces, pour tout le monde. Uniquement en
               production.

     MES_APPAREILS
       Vos propres téléphones. Ils reçoivent des annonces de test MÊME quand
       TEST vaut false — c'est ce qui vous permet de jouer à votre propre jeu
       et de cliquer sans risquer votre compte. Voir le LISEZMOI pour
       récupérer l'identifiant.
     ------------------------------------------------------------------ */
  var ID_INTERSTITIEL = 'ca-app-pub-3940256099942544/1033173712'; /* démo Google */
  var ID_RECOMPENSE   = 'ca-app-pub-3940256099942544/5224354917'; /* démo Google */
  var TEST = true;
  var MES_APPAREILS = [];   /* ex. ['33BE2250B43518CCDA7DE426D04EE231'] */

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
      /* initializeForTesting doit être vrai pour que la liste d'appareils
         soit prise en compte ; elle est vide en production, donc sans effet
         sur les joueurs. */
      return AdMob.initialize({
        initializeForTesting: TEST || MES_APPAREILS.length > 0,
        testingDevices: MES_APPAREILS
      });
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
