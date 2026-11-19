// ==========================================================================
// Rouf's Recommendations - Main Application Logic
// Lightweight, accessible, zero-dependency client logic
// ==========================================================================

(function () {
  'use strict';

  const data = window.ROUFS_DATA || { apps: [], guides: [] };
  let currentCategory = 'all';
  let currentPlatform = 'all';
  let searchQuery = '';

  // DOM Elements
  const appsGrid = document.getElementById('apps-grid');
  const guidesGrid = document.getElementById('guides-grid');
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

  // Initialize
  function init() {
    updateCategoryCounts();
    renderCards();
    renderGuides();
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

    const statTotal = document.getElementById('stat-total-apps');
    if (statTotal) statTotal.textContent = data.apps.length;
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  // Render App Cards
  function renderCards() {
    const filtered = getFilteredApps();
    appsGrid.innerHTML = '';

    resultsCountText.textContent = `Showing ${filtered.length} of ${data.apps.length} recommendations`;

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      appsGrid.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    appsGrid.style.display = 'grid';

    const frag = document.createDocumentFragment();

    filtered.forEach(app => {
      const card = document.createElement('article');
      card.className = 'app-card';
      card.setAttribute('data-id', app.id);
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `View details for ${app.title}`);

      // Badge Class
      let badgeClass = 'badge-free';
      if (app.pricingType === 'foss') badgeClass = 'badge-foss';
      else if (app.pricingType === 'freemium') badgeClass = 'badge-freemium';

      // Primary Link
      const primaryLink = app.links.length > 0 ? app.links[0] : null;

      card.innerHTML = `
        <div class="card-top">
          <img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)} Icon" class="card-icon" loading="lazy">
          <div class="card-header-info">
            <h3 class="card-title">${escapeHtml(app.title)}</h3>
            <div class="card-subcategory">${escapeHtml(app.category)}</div>
            <div class="card-badges">
              <span class="badge ${badgeClass}">${escapeHtml(app.pricing)}</span>
            </div>
          </div>
        </div>
        <div class="card-body">
          <p class="card-overview">${escapeHtml(app.overview)}</p>
          <div class="card-platforms">
            ${app.platforms.map(p => `<span class="platform-tag">${escapeHtml(p)}</span>`).join('')}
          </div>
        </div>
        <div class="card-footer">
          <div class="card-links">
            ${primaryLink ? `
              <a href="${escapeHtml(primaryLink.url)}" target="_blank" rel="noopener" class="btn-card-link" onclick="event.stopPropagation();">
                <span>${escapeHtml(primaryLink.label)}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            ` : ''}
          </div>
          <button type="button" class="btn-view-details" aria-label="View details">
            <span>Details</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      `;

      card.addEventListener('click', () => openModal(app.id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(app.id);
        }
      });

      frag.appendChild(card);
    });

    appsGrid.appendChild(frag);
  }

  // Render Technical Guides
  function renderGuides() {
    guidesGrid.innerHTML = '';
    const frag = document.createDocumentFragment();

    data.guides.forEach(guide => {
      const card = document.createElement('article');
      card.className = 'guide-card';
      card.id = guide.id;

      let stepsHtml = '';
      guide.steps.forEach(s => {
        stepsHtml += `
          <li class="guide-step-item">
            <span class="guide-step-number">${s.step}</span>
            <div style="flex: 1;">
              <div>${s.text}</div>
              ${s.code ? `
                <div class="code-block-wrapper">
                  <button type="button" class="copy-code-btn" data-code="${escapeHtml(s.code)}" aria-label="Copy command">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        `;
      });

      card.innerHTML = `
        <span class="guide-pill">${escapeHtml(guide.badge)} &middot; ${escapeHtml(guide.category)}</span>
        <h3 class="guide-name">${escapeHtml(guide.title)}</h3>
        <p class="guide-summary">${escapeHtml(guide.summary)}</p>
        <ul class="guide-steps-list">
          ${stepsHtml}
        </ul>
      `;

      frag.appendChild(card);
    });

    guidesGrid.appendChild(frag);

    // Bind copy buttons
    guidesGrid.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-code');
        copyToClipboard(code);
      });
    });
  }

  // Open Details Modal
  function openModal(appId) {
    const app = data.apps.find(a => a.id === appId);
    if (!app) return;

    modalIcon.src = app.icon;
    modalIcon.alt = `${app.title} Icon`;
    modalTitle.textContent = app.title;
    modalSubcategory.textContent = `${app.category} • ${app.subcategory}`;

    // Badges
    let badgeClass = 'badge-free';
    if (app.pricingType === 'foss') badgeClass = 'badge-foss';
    else if (app.pricingType === 'freemium') badgeClass = 'badge-freemium';

    modalBadges.innerHTML = `
      <span class="badge ${badgeClass}">${escapeHtml(app.pricing)}</span>
      ${app.platforms.map(p => `<span class="platform-tag">${escapeHtml(p)}</span>`).join('')}
    `;

    // Body
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

    modalBody.innerHTML = `
      <div class="modal-section-title">Overview</div>
      <p>${escapeHtml(app.overview)}</p>
      ${featuresHtml}
    `;

    // Footer Links
    modalLinks.innerHTML = app.links.map(l => `
      <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="btn-card-link">
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

  // Close Details Modal
  function closeModal() {
    modalBackdrop.classList.remove('open');
    modalBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (window.location.hash.startsWith('#app-')) {
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
    } else if (hash && hash.startsWith('#guide-')) {
      const guideEl = document.getElementById(hash.substring(1));
      if (guideEl) {
        setTimeout(() => guideEl.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }

  // Event Listeners
  function bindEvents() {
    // Search input
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (searchQuery.trim().length > 0) {
        searchClearBtn.style.display = 'flex';
        // Auto-switch to All Tools if a restrictive category was active
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
      renderCards();
    });

    // Clear search
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClearBtn.style.display = 'none';
      searchInput.focus();
      renderCards();
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
      renderCards();
    });

    // Platform Chips
    platformChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.platform-chip');
      if (!chip) return;

      platformChips.querySelectorAll('.platform-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentPlatform = chip.getAttribute('data-platform');
      renderCards();
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

      renderCards();
    });

    // Modal Close
    modalCloseBtn.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });

    // Back to top scroll tracking
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
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
