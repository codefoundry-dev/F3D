import { getFileUrl } from '../endpoints/companies';

/**
 * Open a stored file in a new browser tab by its fileId.
 * Resolves the signed URL via the API, then opens it.
 */
export async function openFileInNewTab(fileId: string): Promise<void> {
  const { url } = await getFileUrl(fileId);
  (globalThis as unknown as { open: (url: string, target: string) => void }).open(url, '_blank');
}

/**
 * Trigger a browser download for a stored file.
 * Resolves the signed URL via the API, then initiates the download.
 */
export async function downloadFile(fileId: string, fileName?: string): Promise<void> {
  const { url } = await getFileUrl(fileId);
  const link = (
    globalThis as unknown as {
      document: {
        createElement: (tag: string) => {
          href: string;
          target: string;
          download: string;
          click: () => void;
        };
      };
    }
  ).document.createElement('a');
  link.href = url;
  link.target = '_blank';
  if (fileName) link.download = fileName;
  link.click();
}
