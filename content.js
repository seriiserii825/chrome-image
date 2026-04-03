(() => {
  // Prevent re-injecting the toggle function on repeated script injections
  if (window.__imageInspectorDefined) return;
  window.__imageInspectorDefined = true;

  const ATTR = 'data-img-inspector';
  const OVERLAY_CLASS = 'img-inspector-overlay';
  const STYLE_ID = 'img-inspector-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${OVERLAY_CLASS} {
        position: absolute;
        background: rgba(0, 0, 0, 0.78);
        color: #fff;
        font-family: monospace;
        font-size: 11px;
        line-height: 1.5;
        padding: 5px 8px;
        border-radius: 4px;
        pointer-events: auto;
        z-index: 2147483647;
        box-sizing: border-box;
        max-width: 260px;
        word-break: break-word;
        border: 1px solid rgba(255,255,255,0.15);
        backdrop-filter: blur(2px);
      }
      .${OVERLAY_CLASS} .iil-row {
        display: flex;
        gap: 4px;
      }
      .${OVERLAY_CLASS} .iil-label {
        color: #93c5fd;
        flex-shrink: 0;
      }
      .${OVERLAY_CLASS} .iil-val {
        color: #f1f5f9;
      }
      .${OVERLAY_CLASS} .iil-val.iil-none {
        color: #6b7280;
        font-style: italic;
      }
      .${OVERLAY_CLASS} .iil-copyable {
        cursor: pointer;
        border-bottom: 1px dashed rgba(147,197,253,0.5);
        transition: color 0.15s;
      }
      .${OVERLAY_CLASS} .iil-copyable:hover {
        color: #93c5fd;
      }
      .${OVERLAY_CLASS} .iil-copied {
        color: #4ade80 !important;
        border-bottom-color: #4ade80;
      }
      .${OVERLAY_CLASS} .iil-copy-hint {
        font-size: 9px;
        color: rgba(147,197,253,0.6);
        margin-left: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  function removeStyles() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;');
  }

  function getFilename(url) {
    if (!url || url.startsWith('data:')) return url ? 'inline (data URI)' : '—';
    try {
      const u = new URL(url, location.href);
      const parts = u.pathname.split('/');
      return decodeURIComponent(parts[parts.length - 1]) || '—';
    } catch {
      return '—';
    }
  }

  function formatBytes(bytes) {
    if (bytes == null) return null;
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function row(label, val, empty) {
    const valClass = empty ? 'iil-val iil-none' : 'iil-val';
    return `<div class="iil-row"><span class="iil-label">${escapeHtml(label)}</span><span class="${valClass}">${val}</span></div>`;
  }

  function buildOverlay(img) {
    const div = document.createElement('div');
    div.className = OVERLAY_CLASS;

    const src = img.currentSrc || img.src || '';
    const filename = getFilename(src);
    const alt = img.alt;
    const hasAlt = alt.trim() !== '';
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const dispW = img.width;
    const dispH = img.height;

    const filenameStem = filename.includes('.') && !filename.startsWith('inline')
      ? filename.slice(0, filename.lastIndexOf('.'))
      : filename;
    let html = `<div class="iil-row"><span class="iil-label">name:</span><span class="iil-val iil-copyable" data-copy="${escapeAttr(filenameStem)}">${escapeHtml(filename)}<span class="iil-copy-hint">click to copy</span></span></div>`;
    html += row('alt:', hasAlt ? escapeHtml(alt) : 'none', !hasAlt);
    html += row('natural:', natW && natH ? `${natW} × ${natH} px` : '?');
    html += row('display:', `${dispW} × ${dispH} px`);
    html += row('weight:', '<span class="iil-loading">…</span>');

    div.innerHTML = html;

    // Fetch file size asynchronously
    if (src && !src.startsWith('data:')) {
      fetch(src, { method: 'HEAD', cache: 'force-cache' })
        .then(r => {
          const len = r.headers.get('content-length');
          const sizeEl = div.querySelector('.iil-loading');
          if (sizeEl) {
            sizeEl.className = '';
            sizeEl.textContent = len ? formatBytes(parseInt(len, 10)) : 'unknown';
          }
        })
        .catch(() => {
          const sizeEl = div.querySelector('.iil-loading');
          if (sizeEl) { sizeEl.className = 'iil-none'; sizeEl.textContent = 'unavailable'; }
        });
    } else {
      const sizeEl = div.querySelector('.iil-loading');
      if (sizeEl) {
        sizeEl.className = 'iil-none';
        sizeEl.textContent = src.startsWith('data:') ? 'inline' : '—';
      }
    }

    // Click-to-copy on the name
    div.querySelector('.iil-copyable')?.addEventListener('click', e => {
      const el = e.currentTarget;
      const text = el.dataset.copy;
      const hint = el.querySelector('.iil-copy-hint');
      const markCopied = () => {
        el.classList.add('iil-copied');
        if (hint) hint.textContent = 'copied!';
        setTimeout(() => {
          el.classList.remove('iil-copied');
          if (hint) hint.textContent = 'click to copy';
        }, 1500);
      };
      const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        markCopied();
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(markCopied).catch(fallback);
      } else {
        fallback();
      }
    });

    return div;
  }

  function positionOverlay(overlay, img) {
    const rect = img.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Position relative to document
    let top = rect.bottom + scrollY + 4;
    let left = rect.left + scrollX;

    overlay.style.top = `${top}px`;
    overlay.style.left = `${left}px`;
    overlay.style.minWidth = `${Math.min(rect.width, 220)}px`;
  }

  function attachOverlays() {
    injectStyles();
    const images = document.querySelectorAll('img');

    images.forEach(img => {
      if (img.hasAttribute(ATTR)) return;
      img.setAttribute(ATTR, '1');

      // Make sure parent can contain absolute overlay
      const overlay = buildOverlay(img);

      // Insert overlay into document body (avoids overflow:hidden issues)
      document.body.appendChild(overlay);

      function place() { positionOverlay(overlay, img); }
      place();

      // Update position on load (in case dimensions weren't ready)
      img.addEventListener('load', place, { once: true });
      img._inspectorOverlay = overlay;
    });
  }

  function removeOverlays() {
    document.querySelectorAll('[data-img-inspector]').forEach(img => {
      img.removeAttribute(ATTR);
      img._inspectorOverlay?.remove();
      img._inspectorOverlay = null;
    });
    removeStyles();
  }

  let active = false;

  window.__imageInspectorToggle = function () {
    if (active) {
      removeOverlays();
      active = false;
    } else {
      attachOverlays();
      active = true;
    }
  };
})();
