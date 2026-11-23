// Word World: the real website's settings. deploy/build_pages.py writes site/config.js from this file at publish time,
// with the values from the repository's settings (GitHub > Settings > Secrets and variables > Actions > Variables).
// Everything here is PUBLIC: every visitor's browser downloads this file. That is by design for these values:
//   SUPABASE_URL       the project's address, https://<project-ref>.supabase.co
//   SUPABASE_ANON_KEY  the project's public key ("anon" / "publishable"). It lets a browser ask; the database's rules
//                      (deploy/schema.sql) decide what it gets. NEVER the "service_role" or "secret" key: that one
//                      opens everything, and build_pages.py refuses it.
//   TEACHER_PIN        optional. Typed at the game's door it opens the teacher page, which still asks for the tutor's
//                      email and password. Anyone who reads this file can see it; it opens nothing by itself.
window.WORD_TOWER_CONFIG = {
  SUPABASE_URL: "https://ixrfzemsonxsnljoimrt.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_yopYfJkPW2cN17NbJjt9SA_2RF6ZqKJ",
  TEACHER_PIN: ""
};
// The five prize things of the shop (one after each island test). false: held back until the tutor has seen and approved
// them; delete this line (or set it to true) to let them appear.
window.WW_PRIZES = false;
