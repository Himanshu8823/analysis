/**
 * Object storage configuration.
 *
 * Neon Storage is S3-compatible, so the same settings work for any
 * S3-compatible provider (Neon Storage, AWS S3, Cloudflare R2, MinIO).
 *
 * The backend itself does not read or write file bytes — the browser uploads
 * directly to storage with a presigned URL, and the backend only stores the
 * resulting URL. These credentials are therefore used by the (future)
 * presign endpoint and by anything that needs to talk to storage
 * server-side.
 */
export default () => ({
  storage: {
    s3: {
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION ?? 'us-east-2',
      bucket: process.env.AWS_S3_BUCKET ?? '',
      forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
    },
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES ?? '52428800', 10), // 50MB
    /**
     * Local-disk storage. The multipart upload endpoint writes the file here
     * and hands back a URL the backend can fetch it from, so the upload flow
     * works without a live bucket.
     */
    local: {
      directory: process.env.STORAGE_LOCAL_DIR ?? 'uploads',
      /**
       * The base URL the local file store hands back to callers. Left
       * `undefined` when it is not configured so `StorageService` can apply
       * its own `http://localhost:<port>` fallback — an empty string would
       * survive a `??` check and produce a relative, unusable file URL.
       */
      publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL || undefined,
    },
  },
});
