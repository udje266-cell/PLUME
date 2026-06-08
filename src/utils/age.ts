/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calculates a human's age based on their birthDate string (YYYY-MM-DD).
 * @param birthDateString Birth date in YYYY-MM-DD format
 * @returns calculated age in years
 */
export function calculateAge(birthDateString?: string): number {
  // Âge inconnu => on renvoie 0 (fail-safe) : l'accès au contenu restreint est
  // bloqué tant que la date de naissance n'est pas connue/valide.
  if (!birthDateString) return 0;
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) return 0;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Checks if a user's age allows them metadata access to a rated story.
 * If user age is less than the rating restriction, returns false.
 */
export function isUserAgeAllowed(userAge: number, rating?: 'all' | '12' | '16' | '18'): boolean {
  if (!rating || rating === 'all') return true;
  const numericRating = parseInt(rating, 10);
  if (isNaN(numericRating)) return true;
  return userAge >= numericRating;
}
