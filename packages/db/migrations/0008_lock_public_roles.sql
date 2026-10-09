-- Ferme les tables aux rôles publics de Supabase (anon, authenticated).
--
-- Supabase expose le schéma public par son API REST : sans RLS, quiconque
-- détient la clé « anon » du projet — publique par conception — pouvait
-- lire, modifier et vider toutes les tables. L'application se connecte en
-- `postgres`, propriétaire des tables, que le RLS ne concerne pas : elle
-- n'est pas affectée.
--
-- RLS activé SANS politique = tout refusé aux autres rôles. Les droits sont
-- aussi retirés, et retirés par défaut pour les tables à venir : une table
-- ajoutée par une future migration ne sera pas ouverte par accident.
-- Pour revenir en arrière : DISABLE ROW LEVEL SECURITY + GRANT.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
