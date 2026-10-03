/**
 * Gives every row in `cms_admin_users` a Supabase Auth identity.
 *
 * Authentication is moving to Supabase; authorisation stays in
 * `cms_admin_users`, matched on email. So this script does not move any data --
 * it only creates the credential half, leaving roles exactly where they are.
 *
 * Passwords cannot be carried across: the existing ones are PBKDF2 hashes and
 * cannot be reversed. For the seeded super admin the plaintext is in the
 * environment (SEED_ADMIN_PASSWORD), so that account keeps the password its
 * owner already knows. Any other account is created with a random password and
 * must use "forgot password" -- which is why this prints who that applies to.
 *
 *   npx tsx scripts/migrate-admin-to-supabase-auth.ts --dry-run
 *   npx tsx scripts/migrate-admin-to-supabase-auth.ts
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFileIfPresent(path: string) {
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] === undefined) {
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

async function main() {
  loadEnvFileIfPresent(resolve(process.cwd(), ".env.local"));
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await supabase
    .from("cms_admin_users")
    .select("email, role, is_active")
    .order("created_at", { ascending: true });
  if (error) throw error;

  // One page is plenty: this table holds staff, not visitors.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = new Set((list.users ?? []).map((u) => (u.email ?? "").toLowerCase()));

  const seedEmail = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase();
  const seedPassword = process.env.SEED_ADMIN_PASSWORD ?? "";

  console.log(`${rows?.length ?? 0} admin rows, ${existing.size} Supabase auth users\n`);

  for (const row of rows ?? []) {
    const email = String(row.email).toLowerCase();
    if (existing.has(email)) {
      console.log(`  = ${email.padEnd(28)} already has a Supabase identity`);
      continue;
    }
    const useSeedPassword = email === seedEmail && seedPassword.length >= 8;
    const password = useSeedPassword ? seedPassword : randomBytes(24).toString("base64url");
    const note = useSeedPassword
      ? "same password as before"
      : "RANDOM password -- this account must use 忘记密码";

    if (dryRun) {
      console.log(`  + ${email.padEnd(28)} would create (${note})`);
      continue;
    }
    const { error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: row.role }
    });
    if (createError) {
      console.log(`  ! ${email.padEnd(28)} FAILED: ${createError.message}`);
      continue;
    }
    console.log(`  + ${email.padEnd(28)} created (${note})`);
  }

  console.log(dryRun ? "\n--dry-run: nothing created" : "\ndone");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
