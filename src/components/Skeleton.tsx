/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bloc « squelette » de chargement (placeholder animé). Donne une impression de
 * rapidité pendant les chargements asynchrones, plutôt qu'un écran vide.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-gray-200/80 dark:bg-zinc-800/80 rounded ${className}`}
    />
  );
}
