const REVOKE_AFTER_MS = 1000;

/** Hand a file the app already holds to the browser as a download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // some browsers cancel the download if the address is revoked before it starts
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  }
}
