/*
  Copie ce fichier sous le nom "km-config.js", puis colle les deux valeurs
  publiques indiquées dans Supabase > Project Settings > API.

  La clé "anon" est conçue pour être publique. La sécurité repose sur les
  règles RLS du fichier supabase/schema.sql. Ne jamais placer une clé
  "service_role" dans le site ou dans GitHub.
*/
window.KM_CONFIG = {
  supabaseUrl: "https://TON-PROJET.supabase.co",
  supabaseAnonKey: "TA-CLE-ANON-PUBLIQUE"
};
