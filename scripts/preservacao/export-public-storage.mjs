import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function usage() {
  console.error(
    "Uso: node scripts/preservacao/export-public-storage.mjs <manifest.json> <project-url> <diretorio-destino>",
  );
  process.exit(2);
}

const [, , manifestPath, projectUrlInput, outputDirectory] = process.argv;
if (!manifestPath || !projectUrlInput || !outputDirectory) usage();

const projectUrl = new URL(projectUrlInput);
if (projectUrl.protocol !== "https:" || !projectUrl.hostname.endsWith(".supabase.co")) {
  throw new Error("A URL do projeto deve ser HTTPS e terminar em .supabase.co.");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.objects)) {
  throw new Error("Manifesto inválido: objects deve ser uma lista.");
}

await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
await chmod(outputDirectory, 0o700);

function safeRelativePath(bucketId, objectName) {
  const relative = path.posix.normalize(`${bucketId}/${objectName}`);
  if (
    path.posix.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith("../") ||
    relative.includes("/../")
  ) {
    throw new Error(`Caminho de objeto inseguro: ${bucketId}/${objectName}`);
  }
  return relative;
}

function publicObjectUrl(bucketId, objectName) {
  const encodedPath = objectName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return new URL(
    `/storage/v1/object/public/${encodeURIComponent(bucketId)}/${encodedPath}`,
    projectUrl,
  );
}

async function downloadObject(object) {
  if (!object.public) {
    if (Number(object.size ?? 0) === 0) {
      return { ...object, status: "private-empty-skipped" };
    }
    throw new Error(
      `O bucket ${object.bucket_id} é privado e possui objeto; exportação pública recusada.`,
    );
  }

  const relative = safeRelativePath(object.bucket_id, object.name);
  const destination = path.join(outputDirectory, relative);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });

  const response = await fetch(publicObjectUrl(object.bucket_id, object.name));
  if (!response.ok) {
    throw new Error(
      `Falha ao baixar ${object.bucket_id}/${object.name}: HTTP ${response.status}`,
    );
  }

  const body = Buffer.from(await response.arrayBuffer());
  const expectedSize = Number(object.size ?? 0);
  if (expectedSize > 0 && body.byteLength !== expectedSize) {
    throw new Error(
      `Tamanho divergente em ${object.bucket_id}/${object.name}: esperado ${expectedSize}, recebido ${body.byteLength}`,
    );
  }

  await writeFile(destination, body, { mode: 0o600 });
  await chmod(destination, 0o600);

  return {
    ...object,
    status: "downloaded",
    sha256: createHash("sha256").update(body).digest("hex"),
    local_path: relative,
  };
}

const results = [];
const concurrency = 4;
let cursor = 0;

async function worker() {
  while (cursor < manifest.objects.length) {
    const index = cursor;
    cursor += 1;
    results[index] = await downloadObject(manifest.objects[index]);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const verification = {
  source_manifest: path.resolve(manifestPath),
  project_url: projectUrl.origin,
  exported_at: new Date().toISOString(),
  object_count: results.filter((item) => item.status === "downloaded").length,
  total_bytes: results
    .filter((item) => item.status === "downloaded")
    .reduce((total, item) => total + Number(item.size ?? 0), 0),
  objects: results,
};

const verificationPath = path.join(outputDirectory, "storage-checksums.json");
await writeFile(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, {
  mode: 0o600,
});
await chmod(verificationPath, 0o600);

console.log(
  JSON.stringify({
    object_count: verification.object_count,
    total_bytes: verification.total_bytes,
    verification_file: verificationPath,
  }),
);
