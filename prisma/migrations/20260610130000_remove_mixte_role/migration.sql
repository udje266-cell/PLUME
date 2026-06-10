-- Le rôle « Utilisateur Mixte » est supprimé : les comptes existants deviennent Auteur.
UPDATE "User" SET "role" = 'Auteur' WHERE "role" = 'Utilisateur Mixte';

-- La certification est désormais réservée aux auteurs : on retire le badge à tout
-- compte qui n'est pas Auteur (lecteurs, administrateurs, anciens certifiés).
UPDATE "User" SET "isVerified" = false WHERE "role" <> 'Auteur';
