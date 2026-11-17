/**
 * A line item that may carry a requester-uploaded photo (FOR-404). `photoFile`
 * is optional so callers whose query did not include the relation still work.
 */
export interface LineWithPhoto {
  id: string;
  photoFile?: { key: string } | null;
}

/** The one storage capability needed to show a photo. */
export interface PhotoUrlSigner {
  getSignedUrl(key: string): Promise<string>;
}

/**
 * Sign a display URL for every line that has an uploaded photo, keyed by line
 * id. Lines without a photo are absent from the map, so callers fall back to
 * the catalogue image:
 *
 *   imageUrl: photoUrls.get(li.id) ?? li.material?.imageUrl ?? null
 *
 * A signing failure drops that line's photo rather than failing the read.
 */
export async function signLinePhotoUrls(
  signer: PhotoUrlSigner | undefined,
  lines: LineWithPhoto[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (!signer) return urls;

  await Promise.all(
    lines.map(async (line) => {
      const key = line.photoFile?.key;
      if (!key) return;
      try {
        urls.set(line.id, await signer.getSignedUrl(key));
      } catch {
        // Leave the line without a photo; the catalogue image still applies.
      }
    }),
  );
  return urls;
}
