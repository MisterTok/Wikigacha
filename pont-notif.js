/* Wikigacha — pont de notifications.

   Comme le pont publicitaire : c'est le seul endroit qui connaît le système.
   Le jeu n'appelle que window.WikigachaNotif. Sur le web ouvert ou dans une
   TWA, il ne définit rien et le jeu s'en passe.

   Contrat attendu par le jeu :
     WikigachaNotif.autoriser()             -> Promise<bool>
     WikigachaNotif.planifier(quand, t, m)  -> Promise   (quand = ms epoch)
     WikigachaNotif.annuler()               -> Promise

   Nécessite @capacitor/local-notifications. Sur Android 13 et au-delà, la
   permission POST_NOTIFICATIONS est demandée à l'exécution : on ne la demande
   donc qu'au moment où le joueur active l'option, jamais au lancement. */

(function () {
  'use strict';

  var ID = 1;   /* une seule notification à la fois : la suivante remplace */

  var LN = window.Capacitor
        && window.Capacitor.Plugins
        && window.Capacitor.Plugins.LocalNotifications;
  if (!LN) return;

  window.WikigachaNotif = {
    autoriser: function () {
      return LN.requestPermissions().then(function (r) {
        return !!(r && r.display === 'granted');
      })['catch'](function () { return false; });
    },

    planifier: function (quand, titre, texte) {
      /* On replanifie sans annuler : le même identifiant écrase la
         précédente, ce qui évite de laisser traîner des rappels périmés. */
      return LN.schedule({
        notifications: [{
          id: ID,
          title: titre,
          body: texte,
          schedule: { at: new Date(quand), allowWhileIdle: true }
        }]
      })['catch'](function () {});
    },

    annuler: function () {
      return LN.cancel({ notifications: [{ id: ID }] })['catch'](function () {});
    }
  };
})();
