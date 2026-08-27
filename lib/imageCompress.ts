// Compresses an image in the browser before upload, using canvas
// re-encoding. Reduces both dimensions (capped at maxDimension) and
// re-encodes as JPEG at the given quality, which together typically
// cut file size significantly for typical phone-camera photos.

export type CompressResult = { blob: Blob; width: number; height: number };

export async function compressImage(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {}
): Promise<CompressResult> {
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.75;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image compression failed."))),
      "image/jpeg",
      quality
    );
  });

  return { blob, width, height };
}
