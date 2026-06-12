/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Affichage du rôle. Le statut « Administrateur » est MASQUÉ dans l'interface :
 * il est affiché comme « Auteur » partout, afin que personne ne devine qu'un
 * compte est administrateur. Les POUVOIRS admin restent intacts (la logique
 * s'appuie sur le rôle réel `user.role`, pas sur ce libellé d'affichage).
 */
export function displayRole(role?: string | null): string {
  return role === 'Administrateur' ? 'Auteur' : (role || '');
}
