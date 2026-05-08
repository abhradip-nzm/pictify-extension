/**
 * screenshot.js — injected on demand when user clicks the extension toolbar icon.
 * Renders a full-page dark overlay; user drags to select a region.
 * Sends the cropped screenshot to Pictify.
 */

// Prevent double-injection
if (document.getElementById('pfy-overlay')) {
  document.getElementById('pfy-overlay').remove();
  document.getElementById('pfy-toast')?.remove();
}

// ── Inject styles ─────────────────────────────────────────────
const style = document.createElement('style');
style.id = 'pfy-styles';
style.textContent = `
  #pfy-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    cursor: crosshair;
    background: rgba(0, 0, 0, 0.42);
  }
  #pfy-selection {
    position: fixed;
    display: none;
    border: 2px solid #007AFF;
    box-shadow: 0 0 0 9999px rgba(0,0,0,0.42);
    background: transparent;
    z-index: 2147483647;
    pointer-events: none;
  }
  #pfy-dims {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    background: #007AFF;
    color: white;
    font: 600 11px/1 -apple-system, BlinkMacSystemFont, sans-serif;
    padding: 3px 7px;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
  }
  #pfy-capture-btn {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: #007AFF;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 18px;
    font: 600 13px -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    display: none;
    pointer-events: all;
    box-shadow: 0 4px 16px rgba(0,122,255,0.4);
    transition: opacity 0.15s;
  }
  #pfy-capture-btn:hover { opacity: 0.85; }
  #pfy-toast {
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    background: rgba(0,0,0,0.78);
    color: white;
    font: 500 13px -apple-system, BlinkMacSystemFont, sans-serif;
    padding: 10px 20px;
    border-radius: 999px;
    pointer-events: none;
    white-space: nowrap;
    letter-spacing: 0.01em;
  }
  #pfy-spinner-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    background: rgba(0,0,0,0.55);
  }
  #pfy-spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(255,255,255,0.2);
    border-top-color: #007AFF;
    border-radius: 50%;
    animation: pfySpin 0.7s linear infinite;
  }
  #pfy-spinner-label {
    color: white;
    font: 500 14px -apple-system, BlinkMacSystemFont, sans-serif;
  }
  @keyframes pfySpin { to { transform: rotate(360deg); } }
`;
document.head.appendChild(style);

// ── DOM elements ──────────────────────────────────────────────
const overlay   = document.createElement('div'); overlay.id = 'pfy-overlay';
const selection = document.createElement('div'); selection.id = 'pfy-selection';
const dims      = document.createElement('div'); dims.id = 'pfy-dims';
const captureBtn = document.createElement('button'); captureBtn.id = 'pfy-capture-btn';
captureBtn.textContent = '📷 Capture & Print';

const toast = document.createElement('div'); toast.id = 'pfy-toast';
toast.textContent = 'Drag to select an area  •  Esc to cancel';

selection.appendChild(dims);
selection.appendChild(captureBtn);
document.body.appendChild(overlay);
document.body.appendChild(selection);
document.body.appendChild(toast);

// ── State ─────────────────────────────────────────────────────
let startX = 0, startY = 0, selecting = false;
let finalRect = null;

// ── Mouse handlers ────────────────────────────────────────────
overlay.addEventListener('mousedown', (e) => {
  e.preventDefault();
  startX = e.clientX;
  startY = e.clientY;
  selecting = true;
  finalRect = null;
  captureBtn.style.display = 'none';
  selection.style.display = 'block';
  updateSelection(e.clientX, e.clientY);
});

document.addEventListener('mousemove', (e) => {
  if (!selecting) return;
  updateSelection(e.clientX, e.clientY);
});

document.addEventListener('mouseup', (e) => {
  if (!selecting) return;
  selecting = false;

  const x = Math.min(e.clientX, startX);
  const y = Math.min(e.clientY, startY);
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);

  if (w < 20 || h < 20) {
    selection.style.display = 'none';
    return;
  }

  finalRect = { x, y, w, h };
  captureBtn.style.display = 'block';
  toast.textContent = 'Click "Capture & Print" or drag again to reselect';
});

function updateSelection(mx, my) {
  const x = Math.min(mx, startX);
  const y = Math.min(my, startY);
  const w = Math.abs(mx - startX);
  const h = Math.abs(my - startY);
  selection.style.left   = x + 'px';
  selection.style.top    = y + 'px';
  selection.style.width  = w + 'px';
  selection.style.height = h + 'px';
  dims.textContent = `${Math.round(w)} × ${Math.round(h)}`;
}

// ── Capture button ────────────────────────────────────────────
captureBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!finalRect) return;
  triggerCapture(finalRect);
});

function triggerCapture({ x, y, w, h }) {
  // Hide overlay so it isn't in the screenshot
  overlay.style.display = 'none';
  selection.style.display = 'none';
  toast.style.display = 'none';

  // Small delay so Chrome repaints the page before capturing
  setTimeout(() => {
    chrome.runtime.sendMessage(
      { type: 'captureVisibleTab' },
      (response) => {
        if (!response?.dataUrl) { cleanup(); return; }

        // Show spinner
        overlay.style.display = '';
        const spinner = document.createElement('div');
        spinner.id = 'pfy-spinner-overlay';
        spinner.innerHTML = '<div id="pfy-spinner"></div><div id="pfy-spinner-label">Sending to Pictify…</div>';
        document.body.appendChild(spinner);

        // Crop using Canvas
        const img = new Image();
        img.onload = () => {
          const dpr = window.devicePixelRatio || 1;
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          canvas.getContext('2d').drawImage(
            img,
            Math.round(x * dpr), Math.round(y * dpr),
            Math.round(w * dpr), Math.round(h * dpr),
            0, 0,
            Math.round(w * dpr), Math.round(h * dpr)
          );
          const cropped = canvas.toDataURL('image/png');
          chrome.runtime.sendMessage({ type: 'openWithImage', base64: cropped });
          cleanup();
        };
        img.src = response.dataUrl;
      }
    );
  }, 80);
}

// ── Escape to cancel ──────────────────────────────────────────
document.addEventListener('keydown', onKey);
function onKey(e) { if (e.key === 'Escape') cleanup(); }

function cleanup() {
  overlay.remove();
  selection.remove();
  toast.remove();
  style.remove();
  document.getElementById('pfy-spinner-overlay')?.remove();
  document.removeEventListener('keydown', onKey);
}
