/** Download a blob, preferring a Save As picker when the browser supports it. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const w = window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  };

  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'CSV',
            accept: { 'text/csv': ['.csv'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: unknown) {
      // User cancelled the picker — don't fall back to auto-download
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function downloadTextFile(text: string, filename: string, mime = 'text/csv;charset=utf-8'): Promise<void> {
  await downloadBlob(new Blob([text], { type: mime }), filename);
}
