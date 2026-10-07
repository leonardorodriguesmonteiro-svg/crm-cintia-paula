import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { accessSync } from "node:fs";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const outputDirectory = process.argv[2];
if (!outputDirectory) {
  fail("Uso: node scripts/preservacao/dump-production.mjs <diretorio-destino>");
}

const projectRef = "pxhgfyvpzbcjymmnoyuo";
const host = "aws-1-sa-east-1.pooler.supabase.com";
const port = "5432";
const database = "postgres";
const user = `postgres.${projectRef}`;
const keychainService = "codex.crm-cintia-paula.production-db";
const keychainAccount = `postgres.${projectRef}`;
const postgresBinCandidates = [
  process.env.JORNADA3_POSTGRES_BIN,
  "/Applications/Postgres.app/Contents/Versions/17/bin",
  "/Volumes/Postgres-2.9.6-17/Postgres.app/Contents/Versions/17/bin",
  "/Library/PostgreSQL/17/bin",
].filter(Boolean);

const postgresBin = postgresBinCandidates.find((candidate) => {
  try {
    accessSync(path.join(candidate, "pg_dump"));
    return true;
  } catch {
    return false;
  }
});

if (!postgresBin) {
  fail("Cliente PostgreSQL 17 não encontrado. Defina JORNADA3_POSTGRES_BIN.");
}

function run(binary, args, options = {}) {
  const result = spawnSync(path.join(postgresBin, binary), args, {
    encoding: "utf8",
    env: options.env,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    fail(`${binary} falhou com código ${result.status ?? "desconhecido"}.`);
  }

  return result;
}

const keychain = spawnSync(
  "/usr/bin/security",
  [
    "find-generic-password",
    "-a",
    keychainAccount,
    "-s",
    keychainService,
    "-w",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);

if (keychain.status !== 0 || !keychain.stdout.trim()) {
  fail("Não foi possível obter a credencial do Chaves do macOS.");
}

const env = {
  ...process.env,
  PGPASSWORD: keychain.stdout.trim(),
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "20",
};

await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
await chmod(outputDirectory, 0o700);

const common = [
  "--host",
  host,
  "--port",
  port,
  "--username",
  user,
  "--dbname",
  database,
  "--no-owner",
  "--no-privileges",
  "--no-subscriptions",
];

const fullDump = path.join(outputDirectory, "database.custom");
const schemaDump = path.join(outputDirectory, "schema.sql");
const rolesDump = path.join(outputDirectory, "roles.sql");

run(
  "pg_dump",
  [
    ...common,
    "--format=custom",
    "--compress=9",
    "--file",
    fullDump,
  ],
  { env },
);

run(
  "pg_dump",
  [
    ...common,
    "--schema-only",
    "--format=plain",
    "--file",
    schemaDump,
  ],
  { env },
);

run(
  "pg_dumpall",
  [
    "--host",
    host,
    "--port",
    port,
    "--username",
    user,
    "--roles-only",
    "--no-role-passwords",
    "--file",
    rolesDump,
  ],
  { env },
);

for (const file of [fullDump, schemaDump, rolesDump]) {
  await chmod(file, 0o600);
}

async function describe(file) {
  const contents = await readFile(file);
  const metadata = await stat(file);
  return {
    name: path.basename(file),
    bytes: metadata.size,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

const archiveList = run(
  "pg_restore",
  ["--list", fullDump],
  { env },
).stdout;

const archiveListFile = path.join(outputDirectory, "database.archive-list.txt");
await writeFile(archiveListFile, archiveList, { mode: 0o600 });
await chmod(archiveListFile, 0o600);

const manifest = {
  created_at: new Date().toISOString(),
  source: {
    project_ref: projectRef,
    host,
    port: Number(port),
    database,
    user,
    sslmode: "require",
  },
  pg_dump_version: run("pg_dump", ["--version"], { env }).stdout.trim(),
  files: await Promise.all(
    [fullDump, schemaDump, rolesDump, archiveListFile].map(describe),
  ),
};

const manifestFile = path.join(outputDirectory, "database-backup-manifest.json");
await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, {
  mode: 0o600,
});
await chmod(manifestFile, 0o600);

console.log(
  JSON.stringify({
    manifest: manifestFile,
    files: manifest.files.map(({ name, bytes, sha256 }) => ({
      name,
      bytes,
      sha256,
    })),
  }),
);
