const PICTIFY_UPLOAD_URL = 'https://deft-croissant-f7506d.netlify.app/upload?from=extension';

// ── Register context menus ────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Right-click on any image
    chrome.contextMenus.create({
      id: 'printOnPictify',
      title: '🖨️ Print on Pictify',
      contexts: ['page', 'image', 'link'],
    });
    // Right-click anywhere → screenshot
    chrome.contextMenus.create({
      id: 'screenshotPictify',
      title: '📷 Screenshot & Print on Pictify',
      contexts: ['page', 'image', 'link'],
    });
  });
});

// ── Toolbar icon click → launch screenshot selector ───────────
chrome.action.onClicked.addListener((tab) => {
  launchScreenshot(tab.id);
});

// ── Context menu clicks ───────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {

  // Screenshot mode
  if (info.menuItemId === 'screenshotPictify') {
    launchScreenshot(tab.id);
    return;
  }

  // Image print mode
  if (info.menuItemId !== 'printOnPictify') return;

  let srcUrl = info.srcUrl || null;

  if (!srcUrl && tab?.id) {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'getLastImage' });
      srcUrl = res?.url || null;
    } catch (_) {}
  }

  if (!srcUrl) {
    console.warn('Pictify: no image found at right-click position.');
    return;
  }

  try {
    const response = await fetch(srcUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();

    if (blob.size > 4 * 1024 * 1024) { openPictify({ url: srcUrl }); return; }

    openPictify({ base64: await blobToBase64(blob) });
  } catch (err) {
    console.warn('Pictify: fetch failed, falling back to URL.', err.message);
    openPictify({ url: srcUrl });
  }
});

// ── Messages from screenshot.js ───────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // screenshot.js asks us to capture the visible tab
  if (msg.type === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(
      sender.tab.windowId,
      { format: 'png' },
      (dataUrl) => sendResponse({ dataUrl: dataUrl || null })
    );
    return true; // keep message channel open for async response
  }

  // screenshot.js sends the final cropped base64
  if (msg.type === 'openWithImage') {
    openPictify({ base64: msg.base64 });
  }
});

// ── Inject screenshot selector into a tab ─────────────────────
function launchScreenshot(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['screenshot.js'],
  });
}

// ── Blob → base64 data URL ────────────────────────────────────
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

// ── Open Pictify upload page and inject image ─────────────────
function openPictify({ base64 = null, url = null }) {
  chrome.tabs.create({ url: PICTIFY_UPLOAD_URL }, (tab) => {
    const listener = (tabId, changeInfo) => {
      if (tabId !== tab.id || changeInfo.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (b64, fallbackUrl) => {
          if (b64) localStorage.setItem('pictifyExtImage', b64);
          else if (fallbackUrl) localStorage.setItem('pictifyExtImageUrl', fallbackUrl);
          window.dispatchEvent(new CustomEvent('pictifyExtImage'));
        },
        args: [base64, url],
      });
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}
