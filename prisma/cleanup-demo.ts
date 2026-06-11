/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Nettoyage du contenu de DÉMONSTRATION (comptes + récits de seed).
 *
 * Ce script supprime UNIQUEMENT les comptes de démo créés par `prisma/seed.ts`
 * (identifiés par leur e-mail `*.demo@plume.app`). La suppression d'un compte
 * retire en cascade ses récits, chapitres, commentaires, likes, favoris,
 * abonnements, etc. (relations onDelete: Cascade du schéma).
 *
 * SÉCURITÉ :
 *   - Le compte ADMINISTRATEUR (ADMIN_EMAIL / udje266@gmail.com) est protégé
 *     explicitement : il ne peut jamais être supprimé par ce script.
 *   - Mode par défaut = DRY-RUN : on n'affiche QUE ce qui serait supprimé.
 *     Aucune donnée n'est touchée tant que `--apply` n'est pas passé.
 *
 * Utilisation (ne JAMAIS coller l'URL de prod dans un chat) :
 *   # 1) Aperçu (rien n'est supprimé) :
 *   DATABASE_URL="<url_prod>" npm run db:cleanup-demo
 *   # 2) Suppression réelle, après validation de l'aperçu :
 *   DATABASE_URL="<url_prod>" npm run db:cleanup-demo -- --apply
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// E-mails des comptes de démo créés par le seed.
const DEMO_EMAILS = [
  'elena.demo@plume.app',
  'marcus.demo@plume.app',
  'aria.demo@plume.app',
  'theo.demo@plume.app',
  'sara.demo@plume.app',
  'lina.demo@plume.app',
];

// Comptes à NE JAMAIS supprimer (propriétaire / admin).
const PROTECTED = new Set(
  [process.env.ADMIN_EMAIL || 'udje266@gmail.com'].map((e) => e.toLowerCase()),
);

async function main() {
  const apply = process.argv.includes('--apply');

  const targets = await prisma.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    include: { _count: { select: { stories: true } } },
  });

  const deletable = targets.filter((u) => !PROTECTED.has(u.email.toLowerCase()));

  if (deletable.length === 0) {
    console.log('[cleanup] Aucun compte de démo trouvé. Rien à faire.');
    return;
  }

  console.log(`[cleanup] ${deletable.length} compte(s) de démo détecté(s) :`);
  for (const u of deletable) {
    console.log(`  - ${u.username} <${u.email}> — ${u._count.stories} récit(s) (supprimés en cascade)`);
  }

  if (!apply) {
    console.log('\n[cleanup] DRY-RUN : aucune suppression effectuée.');
    console.log('[cleanup] Relancez avec « -- --apply » pour supprimer réellement.');
    return;
  }

  const result = await prisma.user.deleteMany({
    where: { email: { in: deletable.map((u) => u.email) } },
  });
  console.log(`\n[cleanup] ✅ ${result.count} compte(s) de démo supprimé(s) (récits & contenus liés inclus).`);
}

main()
  .catch((e) => { console.error('[cleanup] échec :', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
