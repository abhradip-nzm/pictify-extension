const PICTIFY_UPLOAD_URL = 'https://deft-croissant-f7506d.netlify.app/upload?from=extension';

// ── Register context menu on install ─────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'printOnPictify',
    title: '🖨️ Print on Pictify',
    contexts: ['image'],
  });
});

// ── Handle right-click → "Print on Pictify" ───────────────────
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'printOnPictify') return;

  const srcUrl = info.srcUrl;
  if (!srcUrl) return;

  try {
    // Fetch the image — extensions bypass CORS with <all_urls> permission
    const response = await fetch(srcUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();

    // Guard: skip if > 4 MB (storage quota protection)
    if (blob.size > 4 * 1024 * 1024) {
      console.warn('Pictify: image too large for storage, passing URL instead.');
      openPictify({ url: srcUrl });
      return;
    }

    const base64 = await blobToBase64(blob);
    openPictify({ base64 });

  } catch (err) {
    // Fallback: pass the raw URL — Upload page will attempt to load it
    console.warn('Pictify: fetch failed, falling back to URL.', err.message);
    openPictify({ url: srcUrl });
  }
});

// ── Convert Blob → base64 data URL ───────────────────────────
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReaderSync?.();
    if (reader) {
      // FileReaderSync is available in some service worker contexts
      try {
        const dataUrl = reader.readAsDataURL(blob);
        resolve(dataUrl);
        return;
      } catch (_) {}
    }

    // Fallback: ArrayBuffer → btoa in chunks
    blob.arrayBuffer().then(buffer => {
      const uint8 = new Uint8Array(buffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < uint8.length; i += chunk) {
        binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
      }
      resolve(`data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`);
    }).catch(reject);
  });
}

// ── Open Pictify upload page and inject image ─────────────────
function openPictify({ base64 = null, url = null }) {
  chrome.tabs.create({ url: PICTIFY_UPLOAD_URL }, (tab) => {
    const listener = (tabId, changeInfo) => {
      if (tabId !== tab.id || changeInfo.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);

      // Inject the image into the page via localStorage + CustomEvent
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (b64, fallbackUrl) => {
          if (b64) {
            localStorage.setItem('pictifyExtImage', b64);
          } else if (fallbackUrl) {
            localStorage.setItem('pictifyExtImageUrl', fallbackUrl);
          }
          // Dispatch event in case the page has already mounted
          window.dispatchEvent(new CustomEvent('pictifyExtImage'));
        },
        args: [base64, url],
      });
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}
