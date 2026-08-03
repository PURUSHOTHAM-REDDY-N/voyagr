import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const REQUIRED_ENV = [
  "R2_ACCOUNT_ID",
  "R2_PUBLIC_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET",
] as const;

function assertS3Env() {
  for (const name of REQUIRED_ENV) {
    if (!process.env[name]) {
      throw new Error(`missing environment variable ${name}`);
    }
  }
}

function s3Client() {
  assertS3Env();
  return new S3Client({
    region: process.env.AWS_REGION || "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    // R2's S3-compatible API only supports path-style requests, not
    // virtual-hosted-style (bucket.endpoint/key).
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function publicUrlFor(key: string) {
  return `${process.env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}

/**
 * Downloads an image from `sourceUrl` and re-uploads it to S3.
 * Mirrors convex/images.ts's `ctx.storage.store` + `ctx.storage.getUrl` pair -
 * the bucket must allow public read on the uploaded object (or be fronted by
 * a CDN) for the returned URL to be directly usable by <img>/<Image>.
 */
export async function uploadImageFromUrl(
  sourceUrl: string,
  keyPrefix: string
): Promise<{ key: string; url: string }> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`failed to download image: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const body = Buffer.from(await response.arrayBuffer());

  const extension = contentType.split("/")[1]?.split("+")[0] ?? "jpg";
  const key = `${keyPrefix}/${randomUUID()}.${extension}`;

  const client = s3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return { key, url: publicUrlFor(key) };
}

export async function deleteImage(key: string): Promise<void> {
  const client = s3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
    })
  );
}
