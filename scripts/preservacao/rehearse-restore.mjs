import { spawnSync } from "node:child_process";
import { accessSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

function fail(message) {
  throw new Error(message);
}

const backupDirectory = process.argv[2];
if (!backupDirectory) {
  console.error(
    "Uso: node scripts/preservacao/rehearse-restore.mjs <diretorio-do-backup>",
  );
  process.exit(2);
}

const postgresBinCandidates = [
  process.env.JORNADA3_POSTGRES_BIN,
  "/Applications/Postgres.app/Contents/Versions/17/bin",
  "/Volumes/Postgres-2.9.6-17/Postgres.app/Contents/Versions/17/bin",
  "/Library/PostgreSQL/17/bin",
].filter(Boolean);

const postgresBin = postgresBinCandidates.find((candidate) => {
  try {
    accessSync(path.join(candidate, "pg_restore"));
    return true;
  } catch {
    return false;
  }
});

if (!postgresBin) {
  console.error(
    "Cliente PostgreSQL 17 não encontrado. Defina JORNADA3_POSTGRES_BIN.",
  );
  process.exit(1);
}
const databaseDump = path.join(backupDirectory, "database.custom");
const rolesDump = path.join(backupDirectory, "roles.sql");
const reportFile = path.join(backupDirectory, "restore-rehearsal-report.json");
const workspace = await mkdtemp(path.join(tmpdir(), "jornada3-restore-"));
const dataDirectory = path.join(workspace, "data");
const socketDirectory = path.join(workspace, "socket");
const logFile = path.join(workspace, "postgres.log");
const port = "55432";
const localAdmin = "jornada3_restore_admin";
const restoreDatabase = "jornada3_restore";

let serverStarted = false;
let currentStage = "preflight";

function run(binary, args, options = {}) {
  const executable = options.absolute ? binary : path.join(postgresBin, binary);
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    fail(`${binary} falhou na etapa ${currentStage}.\n${details}`);
  }

  return result;
}

const report = {
  started_at: new Date().toISOString(),
  source_archive: databaseDump,
  scope: ["public", "private", "auth", "storage"],
  restore_database: restoreDatabase,
  port: Number(port),
  status: "running",
  stage: currentStage,
};

try {
  await readFile(databaseDump);
  const rolesSql = await readFile(rolesDump, "utf8");

  currentStage = "initdb";
  run("initdb", [
    "--pgdata",
    dataDirectory,
    "--username",
    localAdmin,
    "--auth=trust",
    "--encoding=UTF8",
    "--no-locale",
  ]);

  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(socketDirectory, { recursive: true, mode: 0o700 }),
  );

  currentStage = "start";
  run("pg_ctl", [
    "--pgdata",
    dataDirectory,
    "--log",
    logFile,
    "--options",
    `-p ${port} -k ${socketDirectory} -h 127.0.0.1`,
    "--wait",
    "start",
  ]);
  serverStarted = true;

  const connection = [
    "--host",
    socketDirectory,
    "--port",
    port,
    "--username",
    localAdmin,
  ];

  currentStage = "create-database";
  run("createdb", [...connection, restoreDatabase]);

  currentStage = "restore-roles";
  const rehearsalRolesDump = path.join(workspace, "roles.rehearsal.sql");
  await writeFile(
    rehearsalRolesDump,
    rolesSql.replace(/ GRANTED BY [a-zA-Z0-9_]+/g, ""),
    { mode: 0o600 },
  );
  run("psql", [
    "-X",
    ...connection,
    "--dbname",
    restoreDatabase,
    "--set",
    "ON_ERROR_STOP=1",
    "--file",
    rehearsalRolesDump,
  ]);

  currentStage = "prepare-compatible-extensions";
  run("psql", [
    "-X",
    ...connection,
    "--dbname",
    restoreDatabase,
    "--set",
    "ON_ERROR_STOP=1",
    "--command",
    `create schema if not exists extensions;
     create schema if not exists auth authorization supabase_auth_admin;
     create schema if not exists storage authorization supabase_storage_admin;
     create schema if not exists private authorization postgres;
     create extension if not exists pgcrypto with schema extensions;
     create extension if not exists "uuid-ossp" with schema extensions;`,
  ]);

  currentStage = "restore-archive";
  run("pg_restore", [
    ...connection,
    "--dbname",
    restoreDatabase,
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    "--single-transaction",
    "--schema=public",
    "--schema=private",
    "--schema=auth",
    "--schema=storage",
    databaseDump,
  ]);

  currentStage = "validate";
  const validation = run("psql", [
    "-X",
    ...connection,
    "--dbname",
    restoreDatabase,
    "--tuples-only",
    "--no-align",
    "--command",
    `select json_build_object(
      'clientes', (select count(*) from public.clientes),
      'kits', (select count(*) from public.kits),
      'estoque_itens', (select count(*) from public.estoque_itens),
      'reservas', (select count(*) from public.reservas),
      'contratos', (select count(*) from public.contratos),
      'orcamentos', (select count(*) from public.orcamentos),
      'orcamento_itens', (select count(*) from public.orcamento_itens),
      'oportunidades', (select count(*) from public.oportunidades),
      'oportunidade_itens', (select count(*) from public.oportunidade_itens),
      'auditoria_logs', (select count(*) from public.auditoria_logs),
      'auth_users', (select count(*) from auth.users),
      'storage_objects', (select count(*) from storage.objects)
    )`,
  ]).stdout.trim();

  report.status = "passed";
  report.stage = currentStage;
  report.validation = JSON.parse(validation);
} catch (error) {
  report.status = "failed";
  report.stage = currentStage;
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  report.finished_at = new Date().toISOString();
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });

  if (serverStarted) {
    spawnSync(path.join(postgresBin, "pg_ctl"), [
      "--pgdata",
      dataDirectory,
      "--mode=fast",
      "--wait",
      "stop",
    ], { encoding: "utf8", stdio: "ignore" });
  }

  await rm(workspace, { recursive: true, force: true });
}

console.log(JSON.stringify(report));
if (report.status !== "passed") process.exit(1);
