export async function printHtmlDocument(html: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Printing is only available in the browser.');
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  try {
    const frameWindow = iframe.contentWindow;
    const frameDocument = iframe.contentDocument;

    if (!frameWindow || !frameDocument) {
      throw new Error('Unable to open the print document.');
    }

    await new Promise<void>((resolve) => {
      const cleanupAndResolve = () => window.setTimeout(resolve, 50);
      iframe.onload = () => cleanupAndResolve();

      frameDocument.open();
      frameDocument.write(html);
      frameDocument.close();

      window.setTimeout(cleanupAndResolve, 250);
    });

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        window.setTimeout(resolve, 150);
      };

      try {
        frameWindow.onafterprint = finish;
        frameWindow.focus();
        frameWindow.print();
        window.setTimeout(finish, 1000);
      } catch (error) {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      }
    });
  } finally {
    window.setTimeout(() => {
      iframe.remove();
    }, 300);
  }
}
