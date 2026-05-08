const PICTIFY_UPLOAD_URL = 'https://deft-croissant-f7506d.netlify.app/upload?from=extension';

// ── Register context menu on install / update ─────────────────
chrome.runtime.onInstalled.addListener(() => {
  // Remove any stale entries first
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'printOnPictify',
      title: '🖨️ Print on Pictify',
      // 'page' catches right-clicks on overlays; 'image' catches direct <img>
      contexts: ['page', 'image', 'link'],
    });
  });
});

// ── Handle right-click ────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'printOnPictify') return;

  // 1. Prefer the URL Chrome detected directly (works on bare <img> tags)
  let srcUrl = info.srcUrl || null;

  // 2. If no direct srcUrl (e.g. right-clicked an overlay), ask the
  //    content script what image was under the cursor
  if (!srcUrl && tab?.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'getLastImage' });
      srcUrl = response?.url || null;
    } catch (_) {
      // Content script not yet injected on this page (e.g. chrome:// page)
    }
  }

  if (!srcUrl) {
    console.warn('Pictify: no image found at right-click position.');
    return;
  }

  // 3. Fetch the image (extensions bypass CORS with <all_urls> permission)
  try {
    const response = await fetch(srcUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();

    // Guard: if > 4 MB store as URL instead (storage quota)
    if (blob.size > 4 * 1024 * 1024) {
      openPictify({ url: srcUrl });
      return;
    }

    const base64 = await blobToBase64(blob);
    openPictify({ base64 });

  } catch (err) {
    console.warn('Pictify: fetch failed, falling back to URL.', err.message);
    openPictify({ url: srcUrl });
  }
});

// ── Blob → base64 data URL ─────────────────────────────────────
function blobToBase64(blob) {
  return blob.arrayBuffer().then(buffer => {
    const uint8 = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
  });
}

// ── Open Pictify and inject the image ────────────────────────
function openPictify({ base64 = null, url = null }) {
  chrome.tabs.create({ url: PICTIFY_UPLOAD_URL }, (tab) => {
    const listener = (tabId, changeInfo) => {
      if (tabId !== tab.id || changeInfo.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (b64, fallbackUrl) => {
          if (b64) {
            localStorage.setItem('pictifyExtImage', b64);
          } else if (fallbackUrl) {
            localStorage.setItem('pictifyExtImageUrl', fallbackUrl);
          }
          window.dispatchEvent(new CustomEvent('pictifyExtImage'));
        },
        args: [base64, url],
      });
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}
