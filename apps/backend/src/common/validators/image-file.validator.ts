import { BadRequestException } from '@nestjs/common';

export interface ValidatedImage {
  /** The file extension to store it under, derived from the detected type. */
  extension: string;
  /** The MIME type the bytes actually are. */
  contentType: string;
}

/**
 * The image types a profile picture may be.
 *
 * The list is deliberately short: the picture is displayed next to the
 * member's name in the header, so it only has to be a raster image a browser
 * can draw. Vector and animated formats are excluded because they need
 * sanitising before they can be served back to a browser.
 */
const SUPPORTED_IMAGES = [
  {
    extension: '.png',
    contentType: 'image/png',
    /** PNG signature: \x89 P N G \r \n \x1a \n */
    matches: (bytes: Buffer) =>
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  {
    extension: '.jpg',
    contentType: 'image/jpeg',
    /** JPEG signature: F F D8 FF */
    matches: (bytes: Buffer) =>
      bytes.length > 4 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff &&
      bytes[3] !== 0x00,
  },
  {
    extension: '.gif',
    contentType: 'image/gif',
    /** GIF signature: "GIF87a" or "GIF89a" */
    matches: (bytes: Buffer) =>
      bytes.length > 6 &&
      bytes.subarray(0, 3).toString('latin1') === 'GIF' &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61,
  },
  {
    extension: '.webp',
    contentType: 'image/webp',
    /** WebP: "RIFF" .... "WEBP" */
    matches: (bytes: Buffer) =>
      bytes.length > 12 &&
      bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
      bytes.subarray(8, 12).toString('latin1') === 'WEBP',
  },
] as const;

/**
 * The largest profile picture that is accepted: 5 MB.
 *
 * A profile picture is displayed at 32–64 pixels. Anything larger is a
 * mistake or an attempt to fill the bucket, and rejecting it here keeps the
 * bucket and the browser honest.
 */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Checks that the uploaded bytes really are a supported image.
 *
 * The file name and the browser-supplied content type are both attacker
 * controlled, so neither is trusted: the type is decided by the magic bytes
 * at the start of the file. A `.png` that is really an executable is
 * rejected, and so is a renamed one.
 *
 * The extension the file is stored under comes from the detected type, not
 * from the name the client sent — so the stored file always matches its
 * bytes.
 */
export function validateImageFile(file: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}): ValidatedImage {
  if (!file.buffer?.length) {
    throw new BadRequestException('The selected image is empty');
  }

  if (file.size > MAX_AVATAR_BYTES) {
    const limitMb = Math.round(MAX_AVATAR_BYTES / (1024 * 1024));
    throw new BadRequestException(`The image must be smaller than ${limitMb} MB`);
  }

  const detected = SUPPORTED_IMAGES.find((image) => image.matches(file.buffer));
  if (!detected) {
    throw new BadRequestException('The file must be a PNG, JPEG, GIF or WebP image.');
  }

  return {
    extension: detected.extension,
    contentType: detected.contentType,
  };
}
