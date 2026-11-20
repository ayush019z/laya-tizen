/**
 * Laya TV - 2D Spatial Navigation Engine for Samsung Tizen TV Remote
 */
class SpatialNavigator {
  constructor() {
    this.currentFocus = null;
    this.focusableSelector = '.focusable, [tabindex="0"], button, input, .media-card, .track-row, .nav-item, .key-btn, .remote-btn, .mini-btn, .scrubber-track, .side-tab-btn';
    this.history = [];
    this.init();
  }

  init() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    window.addEventListener('click', (e) => {
      const el = e.target.closest(this.focusableSelector);
      if (el) this.setFocus(el);
    }, true);
    // Re-verify focus periodically or on DOM mutations
    const observer = new MutationObserver(() => this.validateFocus());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  }

  getFocusableElements(container = document) {
    const partyModal = document.getElementById('party-modal');
    if (partyModal && (partyModal.classList.contains('active') || partyModal.style.display === 'flex')) {
      container = partyModal;
    }

    const elements = Array.from(container.querySelectorAll(this.focusableSelector));
    return elements.filter(el => {
      // Must be visible
      if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      // Filter out elements hidden inside inactive view-screens
      const view = el.closest('.view-screen');
      if (view && !view.classList.contains('active')) return false;
      const fsPlayer = el.closest('#fullscreen-player');
      if (fsPlayer && !fsPlayer.classList.contains('active')) return false;
      return true;
    });
  }

  setFocus(element) {
    if (!element) return;
    if (this.currentFocus && this.currentFocus !== element) {
      this.currentFocus.classList.remove('focused');
      this.currentFocus.blur();
    }
    this.currentFocus = element;
    element.classList.add('focused');
    try { element.focus(); } catch (e) {}
    
    // Ensure element is visible in view
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    });

    this.showButtonFocusLabel(element);
  }

  showButtonFocusLabel(element) {
    if (!element) return;
    let label = element.getAttribute('data-focus-name') ||
                element.getAttribute('data-name') ||
                element.getAttribute('title');

    const nameMap = {
      'btn-karaoke-stage': 'Vocals Mode',
      'btn-party-jukebox': 'Party Jukebox',
      'btn-fav-track': 'Favorite',
      'btn-toggle-queue': 'Queue',
      'btn-player-settings': 'Audio FX',
      'fs-shuffle-btn': 'Shuffle',
      'fs-prev-btn': 'Previous',
      'fs-play-pause-btn': (window.AudioPlayer && window.AudioPlayer.isPlaying) ? 'Pause' : 'Play',
      'fs-next-btn': 'Next',
      'fs-repeat-btn': 'Repeat',
      'player-scrubber-track': 'Seek',
      'btn-exit-karaoke': 'Exit Vocals Mode',
      'mini-play-pause-btn': (window.AudioPlayer && window.AudioPlayer.isPlaying) ? 'Pause' : 'Play',
      'mini-next-btn': 'Next',
      'btn-voice-search': 'Voice Search',
      'btn-clear-query': 'Clear',
      'btn-dock-search': 'Search'
    };

    if (!label && nameMap[element.id]) {
      label = nameMap[element.id];
    }

    // 1. Update the fixed pill on player screen
    const previewBadge = document.getElementById('player-btn-preview');
    if (previewBadge) {
      const actionText = previewBadge.querySelector('.preview-badge-action');
      if (label && (element.closest('#fullscreen-player') || element.closest('.player-header-card') || element.closest('.player-controls-row'))) {
        if (actionText) actionText.textContent = label;
        previewBadge.classList.add('visible');
      } else {
        previewBadge.classList.remove('visible');
      }
    }

    // 2. High-contrast floating pill directly near the focused button
    let floatingTooltip = document.getElementById('tv-focus-tooltip');
    if (!floatingTooltip) {
      floatingTooltip = document.createElement('div');
      floatingTooltip.id = 'tv-focus-tooltip';
      floatingTooltip.className = 'tv-focus-tooltip';
      document.body.appendChild(floatingTooltip);
    }

    if (label) {
      floatingTooltip.textContent = label;
      const rect = element.getBoundingClientRect();
      const isTop = rect.top < 80;
      const topOffset = isTop ? (rect.bottom + 10) : (rect.top - 12);
      const transformClass = isTop ? 'tooltip-below' : 'tooltip-above';
      floatingTooltip.style.left = Math.round(rect.left + rect.width / 2) + 'px';
      floatingTooltip.style.top = Math.round(topOffset) + 'px';
      floatingTooltip.className = 'tv-focus-tooltip active ' + transformClass;
    } else {
      floatingTooltip.className = 'tv-focus-tooltip';
    }
  }

  validateFocus() {
    if (!this.currentFocus || !document.body.contains(this.currentFocus) || this.currentFocus.offsetParent === null) {
      const candidates = this.getFocusableElements();
      if (candidates.length > 0) {
        this.setFocus(candidates[0]);
      }
    }
  }

  isEnterEvent(e) {
    const code = e.keyCode || e.which;
    const key = e.key;
    return code === 13 || 
           code === 29443 || 
           code === 65385 || 
           key === 'Enter' || 
           key === 'Select' || 
           key === 'Ok' || 
           key === 'Accept';
  }

  handleKeyUp(e) {
    // No-op on keyup to prevent duplicate triggers with keydown
  }

  triggerCurrentAction(e) {
    const now = Date.now();
    if (this._lastActionTime && now - this._lastActionTime < 220) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    this._lastActionTime = now;

    let target = this.currentFocus;

    // Fallback 1: document.activeElement
    if (!target || !document.body.contains(target) || target.offsetParent === null) {
      if (document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement) {
        target = document.activeElement;
      }
    }

    // Fallback 2: first active or visible candidate
    if (!target || !document.body.contains(target) || target.offsetParent === null) {
      const candidates = this.getFocusableElements();
      target = candidates.find(el => el.classList.contains('active')) || candidates[0];
    }

    if (target) {
      this.setFocus(target);
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Single native click call (never double-fire with synthetic events)
      try {
        target.click();
      } catch (err) {
        console.error('[SpatialNav] Target click error:', err);
      }
    }
  }

  handleKeyDown(e) {
    // Media / Back keys handled in remote-keys.js, navigation arrows here
    // Scrubber Bar D-Pad Seeking (Minimalist Remote support)
    if (this.currentFocus && this.currentFocus.id === 'player-scrubber-track') {
      if (e.keyCode === 37) { // Left -> Seek -10s
        e.preventDefault();
        if (window.AudioPlayer) window.AudioPlayer.seekRelative(-10);
        return;
      }
      if (e.keyCode === 39) { // Right -> Seek +10s
        e.preventDefault();
        if (window.AudioPlayer) window.AudioPlayer.seekRelative(10);
        return;
      }
    }

    // Enter / OK / Select handling
    if (this.isEnterEvent(e)) {
      this._enterHandledOnKeyDown = true;
      this.triggerCurrentAction(e);
      return;
    }

    let direction = null;
    switch (e.keyCode) {
      case 37: // ArrowLeft
        direction = 'left';
        break;
      case 38: // ArrowUp
        direction = 'up';
        break;
      case 39: // ArrowRight
        direction = 'right';
        break;
      case 40: // ArrowDown
        direction = 'down';
        break;
      default:
        return;
    }

    if (direction) {
      const moved = this.move(direction);
      if (moved) {
        e.preventDefault();
      }
    }
  }

  move(direction) {
    const focusables = this.getFocusableElements();
    if (focusables.length === 0) return false;

    if (!this.currentFocus || !focusables.includes(this.currentFocus)) {
      this.setFocus(focusables[0]);
      return true;
    }

    const currentRect = this.currentFocus.getBoundingClientRect();
    let bestCandidate = null;
    let minDistance = Infinity;

    for (const el of focusables) {
      if (el === this.currentFocus) continue;
      const targetRect = el.getBoundingClientRect();

      if (!this.isInDirection(currentRect, targetRect, direction)) continue;

      const dist = this.calculateDistance(currentRect, targetRect, direction);
      if (dist < minDistance) {
        minDistance = dist;
        bestCandidate = el;
      }
    }

    if (bestCandidate) {
      this.setFocus(bestCandidate);
      return true;
    }

    return false;
  }

  isInDirection(from, to, dir) {
    const fromCenter = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
    const toCenter = { x: to.left + to.width / 2, y: to.top + to.height / 2 };

    switch (dir) {
      case 'left':
        return toCenter.x < fromCenter.x - 5;
      case 'right':
        return toCenter.x > fromCenter.x + 5;
      case 'up':
        return toCenter.y < fromCenter.y - 5;
      case 'down':
        return toCenter.y > fromCenter.y + 5;
      default:
        return false;
    }
  }

  calculateDistance(from, to, dir) {
    const fromCenter = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
    const toCenter = { x: to.left + to.width / 2, y: to.top + to.height / 2 };

    const dx = Math.abs(fromCenter.x - toCenter.x);
    const dy = Math.abs(fromCenter.y - toCenter.y);

    // Primary axis vs orthogonal penalty
    if (dir === 'left' || dir === 'right') {
      return dx + dy * 2.2;
    } else {
      return dy + dx * 2.2;
    }
  }
}

window.SpatialNav = new SpatialNavigator();
