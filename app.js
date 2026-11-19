// ==========================================================================
// Rouf's Recommendations - Native Tile UI Logic
// ==========================================================================

(function () {
  'use strict';

  const data = window.ROUFS_DATA || { apps: [], guides: [] };
  let currentCategory = 'all';
  let currentPlatform = 'all';
  let searchQuery = '';

  // DOM Elements
  const tilesGrid = document.getElementById('tiles-grid');
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const categoryTabs = document.getElementById('category-tabs');
  const platformChips = document.getElementById('platform-chips');
  const resultsCountText = document.getElementById('results-count-text');
  const emptyState = document.getElementById('empty-state');
  const btnResetFilters = document.getElementById('btn-reset-filters');

  // Modal Elements
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalIcon = document.getElementById('modal-icon');
  const modalTitle = document.getElementById('modal-title');
  const modalSubcategory = document.getElementById('modal-subcategory');
  const modalBody = document.getElementById('modal-body');
  const modalBadges = document.getElementById('modal-badges');
  const modalLinks = document.getElementById('modal-links');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // Toast & Back to Top
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  const backToTopBtn = document.getElementById('back-to-top');

  let toastTimeout = null;
  const fallbackSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%230284c7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='2' width='20' height='20' rx='5' ry='5'/%3E%3Cpath d='M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z'/%3E%3Cline x1='17.5' y1='6.5' x2='17.51' y2='6.5'/%3E%3C/svg%3E";

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Initialize
  function init() {
    updateCategoryCounts();
    renderTiles();
    bindEvents();
    checkUrlHash();
  }

  // Update Category Badge Counts
  function updateCategoryCounts() {
    const counts = {
      all: data.apps.length,
      ios: 0,
      'cross-platform': 0,
      networking: 0,
      homelab: 0,
      'web-indices': 0
    };

    data.apps.forEach(app => {
      if (counts[app.section] !== undefined) {
        counts[app.section]++;
      }
    });

    Object.keys(counts).forEach(key => {
      const el = document.getElementById(`count-${key}`);
      if (el) el.textContent = counts[key];
    });
  }

  // Filter & Scoring Logic
  function getFilteredApps() {
    const query = searchQuery.trim().toLowerCase();
    const matched = [];

    data.apps.forEach(app => {
      // Category check
      if (currentCategory !== 'all' && app.section !== currentCategory) {
        return;
      }

      // Platform check
      if (currentPlatform !== 'all') {
        const hasPlatform = app.platforms.some(p => 
          p.toLowerCase().includes(currentPlatform.toLowerCase())
        );
        if (!hasPlatform) return;
      }

      let score = 0;
      if (query) {
        const titleLower = app.title.toLowerCase();
        const catLower = app.category.toLowerCase();
        const subcatLower = app.subcategory.toLowerCase();

        if (titleLower === query) {
          score += 200;
        } else if (titleLower.startsWith(query)) {
          score += 100;
        } else if (new RegExp('\\b' + escapeRegex(query) + '\\b', 'i').test(titleLower)) {
          score += 80;
        } else if (titleLower.includes(query)) {
          score += 40;
        }

        if (catLower.includes(query) || subcatLower.includes(query)) {
          score += 20;
        }

        if (app.platforms.some(p => p.toLowerCase().includes(query))) {
          score += 15;
        }

        const wordRegex = new RegExp('\\b' + escapeRegex(query) + '\\b', 'i');
        if (wordRegex.test(app.overview)) {
          score += 10;
        } else if (app.overview.toLowerCase().includes(query)) {
          score += 2;
        }

        const featureMatches = app.features.some(f => 
          wordRegex.test(f.label) || wordRegex.test(f.text) || f.label.toLowerCase().includes(query) || f.text.toLowerCase().includes(query)
        );
        if (featureMatches) {
          score += 5;
        }

        if (score === 0) return;
      } else {
        score = 1;
      }

      matched.push({ app, score });
    });

    if (query) {
      matched.sort((a, b) => b.score - a.score || a.app.title.localeCompare(b.app.title));
    } else {
      matched.sort((a, b) => a.app.title.localeCompare(b.app.title));
    }

    return matched.map(m => m.app);
  }

  // Render App Tiles
  function renderTiles() {
    const filtered = getFilteredApps();
    tilesGrid.innerHTML = '';

    resultsCountText.textContent = `${filtered.length} Recommendation${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      tilesGrid.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    tilesGrid.style.display = 'grid';

    const frag = document.createDocumentFragment();

    filtered.forEach(app => {
      const tile = document.createElement('article');
      tile.className = 'app-tile';
      tile.setAttribute('data-id', app.id);
      tile.setAttribute('tabindex', '0');
      tile.setAttribute('role', 'button');
      tile.setAttribute('aria-label', `View details for ${app.title}`);

      let badgeClass = 'badge-free';
      if (app.pricingType === 'foss') badgeClass = 'badge-foss';
      else if (app.pricingType === 'freemium') badgeClass = 'badge-freemium';

      tile.innerHTML = `
        <div class="tile-icon-wrap">
          <img src="${escapeHtml(app.icon || fallbackSvg)}" onerror="this.onerror=null;this.src='${fallbackSvg}'" alt="${escapeHtml(app.title)} Icon" class="tile-icon" loading="lazy">
        </div>
        <div class="tile-info">
          <h3 class="tile-title">${escapeHtml(app.title)}</h3>
          <div class="tile-category">${escapeHtml(app.category)}</div>
          <div class="tile-badges">
            <span class="badge ${badgeClass}">${escapeHtml(app.pricing)}</span>
          </div>
        </div>
      `;

      tile.addEventListener('click', () => openModal(app.id));
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(app.id);
        }
      });

      frag.appendChild(tile);
    });

    tilesGrid.appendChild(frag);
  }

  // Open Details Modal / Sheet
  function openModal(appId) {
    const app = data.apps.find(a => a.id === appId);
    if (!app) return;

    modalIcon.onerror = function() { this.src = fallbackSvg; };
    modalIcon.src = app.icon || fallbackSvg;
    modalIcon.alt = `${app.title} Icon`;
    modalTitle.textContent = app.title;
    modalSubcategory.textContent = `${app.category} • ${app.subcategory}`;

    // Badges
    let badgeClass = 'badge-free';
    if (app.pricingType === 'foss') badgeClass = 'badge-foss';
    else if (app.pricingType === 'freemium') badgeClass = 'badge-freemium';

    modalBadges.innerHTML = `
      <span class="badge ${badgeClass}">${escapeHtml(app.pricing)}</span>
      ${app.platforms.map(p => `<span class="badge badge-free">${escapeHtml(p)}</span>`).join('')}
    `;

    // Key Capabilities
    let featuresHtml = '';
    if (app.features.length > 0) {
      featuresHtml = `
        <div class="modal-section-title">Key Capabilities</div>
        <ul class="modal-features-list">
          ${app.features.map(f => `
            <li class="modal-feature-item">
              ${f.label ? `<strong>${escapeHtml(f.label)}:</strong> ` : ''}${escapeHtml(f.text)}
            </li>
          `).join('')}
        </ul>
      `;
    }

    // Embedded Setup Guide (if present for this service)
    let guideHtml = '';
    if (app.guide) {
      const stepsHtml = app.guide.steps.map(s => `
        <li class="modal-guide-step">
          <span class="guide-step-number">${s.step}</span>
          <div style="flex: 1;">
            <div>${s.text}</div>
            ${s.code ? `
              <div class="code-block-wrapper">
                <button type="button" class="copy-code-btn" data-code="${escapeHtml(s.code)}" aria-label="Copy command">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy
                </button>
                <code>${escapeHtml(s.code)}</code>
              </div>
            ` : ''}
          </div>
        </li>
      `).join('');

      guideHtml = `
        <div class="modal-guide-section">
          <span class="modal-guide-badge">${escapeHtml(app.guide.badge || 'Setup Guide')}</span>
          <h4 class="modal-guide-name">${escapeHtml(app.guide.title)}</h4>
          ${app.guide.summary ? `<p class="modal-guide-summary">${escapeHtml(app.guide.summary)}</p>` : ''}
          <ul class="modal-guide-steps">
            ${stepsHtml}
          </ul>
        </div>
      `;
    }

    modalBody.innerHTML = `
      <div class="modal-section-title">Overview</div>
      <p>${escapeHtml(app.overview)}</p>
      ${featuresHtml}
      ${guideHtml}
    `;

    // Bind copy buttons inside modal
    modalBody.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-code');
        copyToClipboard(code);
      });
    });

    // Action Links
    modalLinks.innerHTML = app.links.map(l => `
      <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="btn-modal-link">
        <span>${escapeHtml(l.label)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    `).join('');

    // Open & set hash
    modalBackdrop.classList.add('open');
    modalBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.location.hash = `app-${app.id}`;
    modalCloseBtn.focus();
  }

  // Close Details Modal / Sheet
  function closeModal() {
    modalBackdrop.classList.remove('open');
    modalBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (window.location.hash.startsWith('#app-') || window.location.hash.startsWith('#guide-')) {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
  }

  // Toast Notification
  function showToast(msg) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastMessage.textContent = msg;
    toast.classList.add('show');
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Copy to Clipboard
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('Copied to clipboard!');
    } catch {
      showToast('Press Ctrl+C to copy');
    }
    document.body.removeChild(textArea);
  }

  // URL Hash Navigation
  function checkUrlHash() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#app-')) {
      const appId = hash.replace('#app-', '');
      openModal(appId);
    } else if (hash === '#guide-dns') {
      openModal('dnsecure');
    } else if (hash === '#guide-cloudflare') {
      openModal('cloudflare-one');
    } else if (hash === '#guide-twingate') {
      openModal('twingate');
    }
  }

  // Event Listeners
  function bindEvents() {
    // Search input
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (searchQuery.trim().length > 0) {
        searchClearBtn.style.display = 'flex';
        // Auto-switch to All if another category was active
        if (currentCategory !== 'all') {
          currentCategory = 'all';
          categoryTabs.querySelectorAll('.category-pill').forEach(b => {
            const isAll = b.getAttribute('data-category') === 'all';
            b.classList.toggle('active', isAll);
            b.setAttribute('aria-selected', isAll ? 'true' : 'false');
          });
        }
      } else {
        searchClearBtn.style.display = 'none';
      }
      renderTiles();
    });

    // Clear search
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClearBtn.style.display = 'none';
      searchInput.focus();
      renderTiles();
    });

    // Keyboard shortcut '/' to search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) {
        closeModal();
      }
    });

    // Category Tabs
    categoryTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-pill');
      if (!btn) return;

      categoryTabs.querySelectorAll('.category-pill').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentCategory = btn.getAttribute('data-category');
      renderTiles();
    });

    // Platform Chips
    platformChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.platform-chip');
      if (!chip) return;

      platformChips.querySelectorAll('.platform-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentPlatform = chip.getAttribute('data-platform');
      renderTiles();
    });

    // Reset Filters Button
    btnResetFilters.addEventListener('click', () => {
      searchQuery = '';
      searchInput.value = '';
      searchClearBtn.style.display = 'none';
      currentCategory = 'all';
      currentPlatform = 'all';

      categoryTabs.querySelectorAll('.category-pill').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-category') === 'all');
        b.setAttribute('aria-selected', b.getAttribute('data-category') === 'all');
      });

      platformChips.querySelectorAll('.platform-chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-platform') === 'all');
      });

      renderTiles();
    });

    // Modal Close
    modalCloseBtn.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });

    // Back to top scroll tracking
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }, { passive: true });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('hashchange', checkUrlHash);
  }

  // HTML sanitization helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Kickoff
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
