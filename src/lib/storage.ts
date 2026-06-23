import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3-compatible object storage. Works against AWS S3 (no endpoint) and
// Cloudflare R2 / MinIO / etc. (set STORAGE_ENDPOINT). All config comes from
// env — never from source. When the required vars are unset, isStorageConfigured()
// returns false and callers fall back to local-disk storage so dev still works.

const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT || undefined;
const STORAGE_REGION = process.env.STORAGE_REGION || "auto";
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "";
const STORAGE_ACCESS_KEY_ID = process.env.STORAGE_ACCESS_KEY_ID || "";
const STORAGE_SECRET_ACCESS_KEY = process.env.STORAGE_SECRET_ACCESS_KEY || "";

export function isStorageConfigured(): boolean {
  return Boolean(STORAGE_BUCKET && STORAGE_ACCESS_KEY_ID && STORAGE_SECRET_ACCESS_KEY);
}

let cached: S3Client | null = null;

function client(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error("Object storage is not configured (set STORAGE_* env vars)");
  }
  if (!cached) {
    cached = new S3Client({
      region: STORAGE_REGION,
      endpoint: STORAGE_ENDPOINT,
      // R2 and most non-AWS endpoints require path-style addressing.
      forcePathStyle: Boolean(STORAGE_ENDPOINT),
      credentials: {
        accessKeyId: STORAGE_ACCESS_KEY_ID,
        secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
      },
    });
  }
  return cached;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType?: string | null
): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType ?? undefined,
    })
  );
  return key;
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
}
