/**
 * Content script — runs on every page.
 * Tracks the image the user right-clicked on, even when
 * an overlay div sits on top of the actual <img>.
 */

let lastImageUrl = null;

document.addEventListener('contextmenu', (e) => {
  lastImageUrl = null;

  // Walk up the DOM from the right-clicked element
  let el = e.target;
  while (el && el.tagName !== 'BODY') {

    // Direct <img> element
    if (el.tagName === 'IMG' && el.src) {
      // Prefer the highest-res src from srcset if available
      if (el.currentSrc) {
        lastImageUrl = el.currentSrc;
      } else {
        lastImageUrl = el.src;
      }
      break;
    }

    // <picture> element — grab the active <img> inside
    if (el.tagName === 'PICTURE') {
      const img = el.querySelector('img');
      if (img?.currentSrc || img?.src) {
        lastImageUrl = img.currentSrc || img.src;
        break;
      }
    }

    // CSS background-image
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (match && match[1] && !match[1].startsWith('data:')) {
        lastImageUrl = match[1];
        break;
      }
    }

    el = el.parentElement;
  }

  // Also do a proximity search — find any <img> near the click coords
  if (!lastImageUrl) {
    const imgs = document.querySelectorAll('img');
    let closest = null;
    let closestDist = 80; // max pixel distance
    for (const img of imgs) {
      if (!img.src) continue;
      const rect = img.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist < closestDist && rect.width > 40 && rect.height > 40) {
        closestDist = dist;
        closest = img;
      }
    }
    if (closest) {
      lastImageUrl = closest.currentSrc || closest.src;
    }
  }
}, true /* capture phase — runs before any overlay handler */);

// Respond to background.js requesting the image URL
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'getLastImage') {
    sendResponse({ url: lastImageUrl });
  }
});
