/**
 * Laya TV - UI View Controller & Exact Laya Television Components
 */
class UIViewController {
  constructor() {
    this.currentView = 'home';
    this.searchQuery = '';
    this.toastTimer = null;
    this.activeLyricIndex = -1;
    this.activeWordIndex = -1;
    this.showingQueue = false;
    this.isScreensaverActive = false;
    this.isKaraokeActive = false;
    this.roomCode = 'LAYA-' + Math.floor(1000 + Math.random() * 9000);
    this.screensaverTimer = null;
    this.init();
  }

  init() {
    this.ensureDynamicDOM();
    if (window.Queue && window.MusicProvider && window.MusicProvider.curatedCatalogue) {
      window.Queue.setQueue(window.MusicProvider.curatedCatalogue, 0);
      const first = window.Queue.getCurrentTrack();
      if (first && window.AudioPlayer) {
        window.AudioPlayer.updateMetadataUI(first);
      }
    }
    this.setupNavigation();
    this.setupTopBar();
    this.setupMiniPlayer();
    this.setupFullscreenPlayer();
    this.setupPartyJukebox();
    this.setupScreensaver();
    this.setupKaraokeStage();
    this.setupVisualizer();
    this.setupDualScriptToggle();
    this.setupPlaylistImporter();
    this.setupWirelessMic();
    this.setupRemoteBridge();
    this.setupLyricsSyncControls();
    this.renderHome();
    this.renderVirtualKeyboard();
  }

  setupTopBar() {
    const backBtn = document.getElementById('btn-header-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (window.RemoteController) {
          window.RemoteController.handleBackAction();
        }
      });
    }

    const settingsBtn = document.getElementById('btn-header-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.switchView('settings');
      });
    }

    const partyBtn = document.getElementById('btn-header-party');
    if (partyBtn) {
      partyBtn.addEventListener('click', () => {
        this.openPartyModal();
      });
    }
  }

  setupNavigation() {
    // Floating Nav Capsule Pills
    const navPills = document.querySelectorAll('.nav-tab-pill');
    navPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const view = pill.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Circular Search Button in Dock
    const searchBtn = document.getElementById('btn-dock-search');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.switchView('search');
      });
    }
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Update Floating Nav Pills active state
    document.querySelectorAll('.nav-tab-pill').forEach(pill => {
      if (pill.getAttribute('data-view') === viewName) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    // Update Visible View Screen
    document.querySelectorAll('.view-screen').forEach(screen => {
      screen.classList.remove('active');
    });

    const activeScreen = document.getElementById(`view-${viewName}`);
    if (activeScreen) {
      activeScreen.classList.add('active');
    }

    // Refresh view content
    if (viewName === 'home') {
      this.renderHome();
    } else if (viewName === 'history') {
      this.renderHistory();
    } else if (viewName === 'library') {
      this.renderLibrary();
    } else if (viewName === 'settings') {
      this.renderSettings();
    } else if (viewName === 'search') {
      const searchInput = document.getElementById('search-input-field');
      if (searchInput && this.searchQuery) {
        searchInput.value = this.searchQuery;
      }
    }

    // Direct focus to first element in new view
    setTimeout(() => {
      if (window.SpatialNav) {
        if (viewName === 'search') {
          // On Search screen, focus the 'Q' key on the QWERTY keyboard
          const keys = activeScreen ? Array.from(activeScreen.querySelectorAll('.key-btn')) : [];
          const qKey = keys.find(k => k.textContent === 'Q') || keys[0];
          if (qKey) {
            window.SpatialNav.setFocus(qKey);
            return;
          }
        }

        const firstFocus = activeScreen ? activeScreen.querySelector('.focusable, .media-card, .track-row, .recognized-track-row, .key-btn, input') : null;
        if (firstFocus) {
          window.SpatialNav.setFocus(firstFocus);
        } else {
          window.SpatialNav.validateFocus();
        }
      }
    }, 50);
  }

  // --- 1. Home / Discover Shelves ---
  async renderHome() {
    const container = document.getElementById('home-shelves-container');
    if (!container) return;

    const shelves = await window.MusicProvider.getHomeFeed();
    container.innerHTML = '';

    shelves.forEach(shelf => {
      const shelfElem = document.createElement('div');
      shelfElem.className = 'shelf';

      const titleElem = document.createElement('div');
      titleElem.className = 'shelf-title';
      titleElem.textContent = shelf.title;
      shelfElem.appendChild(titleElem);

      const trackContainer = document.createElement('div');
      trackContainer.className = 'shelf-track-container';

      if (shelf.isMixShelf) {
        shelf.items.forEach(mix => {
          const card = document.createElement('div');
          card.className = 'shelf-mix-card focusable';
          card.setAttribute('tabindex', '0');
          card.setAttribute('data-focus-name', mix.title);
          card.style.background = mix.gradient;

          card.innerHTML = `
            <div class="mix-card-badge">${mix.badge}</div>
            <div>
              <div class="mix-card-title">${mix.title}</div>
              <div class="mix-card-sub">${mix.subtitle}</div>
            </div>
          `;

          card.addEventListener('click', async () => {
            this.showToast(`Launching ${mix.title}...`);
            const tracks = await window.MusicProvider.search(mix.query);
            if (tracks && tracks.length > 0) {
              window.Queue.setQueue(tracks, 0);
              window.AudioPlayer.playTrack(tracks[0]);
              this.openFullscreenPlayer();
            }
          });

          trackContainer.appendChild(card);
        });
      } else {
        shelf.items.forEach(track => {
          const card = document.createElement('div');
          card.className = 'media-card focusable';
          card.setAttribute('tabindex', '0');

          card.innerHTML = `
            <div class="media-card-artwork">
              <img src="${track.artwork}" alt="${track.title}" loading="lazy"/>
            </div>
            <div class="media-card-title">${track.title}</div>
            <div class="media-card-author">${track.artist}</div>
          `;

          card.addEventListener('click', () => {
            window.Queue.setQueue(shelf.items, shelf.items.indexOf(track));
            window.AudioPlayer.playTrack(track);
            this.openFullscreenPlayer();
          });

          trackContainer.appendChild(card);
        });
      }

      shelfElem.appendChild(trackContainer);
      container.appendChild(shelfElem);
    });

    if (window.SpatialNav) {
      const firstCard = container.querySelector('.media-card');
      if (firstCard) {
        window.SpatialNav.setFocus(firstCard);
      } else {
        window.SpatialNav.validateFocus();
      }
    }
  }

  // --- 2. Listening History Screen ---
  renderHistory() {
    const container = document.getElementById('history-songs-list');
    if (!container) return;

    const historyItems = window.Library.getHistory();
    const clearBtn = document.getElementById('btn-clear-history');

    if (clearBtn && !clearBtn._bound) {
      clearBtn._bound = true;
      clearBtn.addEventListener('click', () => {
        window.Library.clearHistory();
        this.renderHistory();
      });
    }

    if (!historyItems || historyItems.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 0; color: var(--text-dim);">
          <div style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">No listening history yet</div>
          <div style="font-size: 16px;">Songs you play on your TV will be listed here.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    historyItems.forEach(track => {
      const row = document.createElement('div');
      row.className = 'recognized-track-row focusable';
      row.setAttribute('tabindex', '0');
      row.setAttribute('data-id', track.id);

      row.innerHTML = `
        <div class="recognized-artwork">
          <img src="${track.artwork}" alt="${track.title}" loading="lazy"/>
        </div>
        <div class="recognized-info">
          <div class="recognized-track-title">${track.title}</div>
          <div class="recognized-track-sub">${track.artist}</div>
        </div>
        <div style="font-size: 14px; color: var(--text-dim); margin-right: 8px;">${track.durationFormatted || '3:00'}</div>
      `;

      row.addEventListener('click', () => {
        window.Queue.setQueue([track]);
        window.AudioPlayer.playTrack(track);
        this.openFullscreenPlayer();
      });

      container.appendChild(row);
    });
  }

  // --- 3. Search & TV Virtual Keyboard (Classic Standard QWERTY Layout) ---
  renderVirtualKeyboard() {
    const kbContainer = document.getElementById('tv-keyboard');
    if (!kbContainer) return;

    // Classic Standard QWERTY Layout for TV Remote Navigation
    const rows = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '-', '_'],
      ['SPACE', 'DEL', 'CLEAR', 'SEARCH']
    ];

    kbContainer.innerHTML = '';

    rows.forEach(row => {
      const rowElem = document.createElement('div');
      rowElem.className = 'tv-keyboard-row';

      row.forEach(key => {
        const keyBtn = document.createElement('button');
        keyBtn.className = 'key-btn focusable';
        keyBtn.setAttribute('tabindex', '0');
        keyBtn.textContent = key === 'SPACE' ? '␣ SPACE' : (key === 'DEL' ? '⌫ DEL' : (key === 'CLEAR' ? '✕ CLEAR' : (key === 'SEARCH' ? '🔍 SEARCH' : key)));

        if (key === 'SPACE') keyBtn.classList.add('key-btn-space');
        if (key === 'DEL' || key === 'CLEAR') keyBtn.classList.add('key-btn-action');
        if (key === 'SEARCH') keyBtn.classList.add('key-btn-search');

        keyBtn.addEventListener('click', () => this.handleVirtualKey(key));
        rowElem.appendChild(keyBtn);
      });

      kbContainer.appendChild(rowElem);
    });

    const searchInput = document.getElementById('search-input-field');
    if (searchInput && !searchInput._boundInput) {
      searchInput._boundInput = true;
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.triggerLiveSearch();
      });
    }

    const clearQueryBtn = document.getElementById('btn-clear-query');
    if (clearQueryBtn) {
      clearQueryBtn.addEventListener('click', () => {
        const input = document.getElementById('search-input-field');
        if (input) input.value = '';
        this.searchQuery = '';
        const resultsContainer = document.getElementById('search-results-container');
        if (resultsContainer) resultsContainer.innerHTML = '';
      });
    }

    const voiceBtn = document.getElementById('btn-voice-search');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => this.startVoiceSearch());
    }
  }

  triggerLiveSearch() {
    clearTimeout(this._searchDebounceTimer);
    const query = (this.searchQuery || '').trim();
    const resultsContainer = document.getElementById('search-results-container');
    if (!query) {
      if (resultsContainer) resultsContainer.innerHTML = '';
      return;
    }

    // Trigger instant search as user types without requiring search button click
    if (query.length >= 2) {
      this._searchDebounceTimer = setTimeout(() => {
        this.executeSearch(false); // false = keep focus on typing keyboard
      }, 320);
    }
  }

  handleVirtualKey(key) {
    const now = Date.now();
    if (this._lastKeyTime && now - this._lastKeyTime < 160) {
      return;
    }
    this._lastKeyTime = now;

    const input = document.getElementById('search-input-field');
    if (!input) return;

    if (key === 'SPACE') {
      input.value += ' ';
    } else if (key === 'DEL') {
      input.value = input.value.slice(0, -1);
    } else if (key === 'CLEAR') {
      input.value = '';
      this.searchQuery = '';
      const resultsContainer = document.getElementById('search-results-container');
      if (resultsContainer) resultsContainer.innerHTML = '';
      return;
    } else if (key === 'SEARCH') {
      this.executeSearch(true); // true = focus first result
      return;
    } else {
      input.value += key;
    }
    this.searchQuery = input.value;
    this.triggerLiveSearch();
  }

  startVoiceSearch() {
    this.switchView('search');
    const input = document.getElementById('search-input-field');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        this.showToast('Listening... Speak into remote');

        recognition.onresult = (event) => {
          if (event.results && event.results.length > 0) {
            const transcript = event.results[0][0].transcript;
            if (input) input.value = transcript;
            this.searchQuery = transcript;
            this.showToast(`Heard: "${transcript}"`);
            this.executeSearch();
          }
        };

        recognition.onerror = () => {
          this.showToast('Speak or enter search query');
          if (input) input.focus();
        };

        recognition.start();
        return;
      } catch (e) {}
    }

    this.showToast('Speak into TV microphone');
    if (input) input.focus();
  }

  async executeSearch(autoFocusFirst = true) {
    const query = this.searchQuery.trim();
    const resultsContainer = document.getElementById('search-results-container');
    if (!resultsContainer) return;

    if (!query) {
      resultsContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 18px; padding: 24px; text-align: center;">Please type a song or artist name to search.</div>';
      return;
    }

    if (autoFocusFirst) {
      resultsContainer.innerHTML = `<div style="color: var(--text-sub); font-size: 18px; padding: 24px; text-align: center;">Searching for "${query}"...</div>`;
    }

    const results = await window.MusicProvider.search(query);
    resultsContainer.innerHTML = '';

    if (!results || results.length === 0) {
      resultsContainer.innerHTML = `<div style="color: var(--text-dim); font-size: 18px; padding: 30px; text-align: center;">No tracks found for "${query}". Try another title or artist.</div>`;
      return;
    }

    const titleHeader = document.createElement('div');
    titleHeader.style.cssText = 'font-size: 16px; font-weight: 700; color: var(--text-dim); margin-bottom: 14px; text-transform: uppercase; letter-spacing: 1px;';
    titleHeader.textContent = `Search Results (${results.length})`;
    resultsContainer.appendChild(titleHeader);

    results.forEach(track => {
      const row = document.createElement('div');
      row.className = 'recognized-track-row focusable';
      row.setAttribute('tabindex', '0');
      row.innerHTML = `
        <div class="recognized-artwork">
          <img src="${track.artwork}" alt="${track.title}" loading="lazy"/>
        </div>
        <div class="recognized-info">
          <div class="recognized-track-title">${track.title}</div>
          <div class="recognized-track-sub">${track.artist} · ${track.album || ''}</div>
        </div>
        <div style="font-size: 14px; color: var(--text-dim); font-variant-numeric: tabular-nums;">${track.durationFormatted || '3:20'}</div>
      `;

      row.addEventListener('click', () => {
        window.Queue.setQueue(results, results.indexOf(track));
        window.AudioPlayer.playTrack(track);
        this.openFullscreenPlayer();
      });

      resultsContainer.appendChild(row);
    });

    // Auto-focus the first search result ONLY when explicitly requested (e.g. clicked SEARCH button)
    // When live-typing, keep focus on the keyboard so typing is uninterrupted
    if (autoFocusFirst) {
      setTimeout(() => {
        const firstRow = resultsContainer.querySelector('.recognized-track-row');
        if (firstRow && window.SpatialNav) {
          window.SpatialNav.setFocus(firstRow);
        }
      }, 100);
    }
  }

  // --- 4. Library Screen (Liked Songs & Playlists) ---
  renderLibrary() {
    const container = document.getElementById('library-content');
    if (!container) return;

    const favorites = window.Library.getFavorites();
    const importedPlaylists = window.Library.getPlaylists ? window.Library.getPlaylists() : [];

    let html = `
      <div class="import-promo-banner focusable" tabindex="0" id="banner-import-playlist" data-focus-name="Import External Playlists">
        <div class="import-promo-icon">📲</div>
        <div class="import-promo-text">
          <div class="import-promo-title">Import Playlists from Spotify, Apple Music & JioSaavn</div>
          <div class="import-promo-sub">Click here or scan on your phone to instantly sync playlists to your TV</div>
        </div>
        <button class="pill-opt-btn" style="background: #1db954; color: #fff; padding: 10px 20px; font-weight: 700; pointer-events: none;">Import Now</button>
      </div>

      <div class="shelf">
        <div class="shelf-title">Liked Songs ❤️ (${favorites.length})</div>
        <div class="track-list">
    `;

    if (favorites.length > 0) {
      favorites.forEach(t => {
        html += `
          <div class="recognized-track-row focusable" tabindex="0" data-id="${t.id}">
            <div class="recognized-artwork"><img src="${t.artwork}"/></div>
            <div class="recognized-info"><div class="recognized-track-title">${t.title}</div><div class="recognized-track-sub">${t.artist}</div></div>
            <div style="font-size: 14px; color: var(--text-dim);">${t.durationFormatted || '3:00'}</div>
          </div>
        `;
      });
    } else {
      html += `<div style="padding: 20px; color: var(--text-dim);">No liked songs yet. Click the heart icon on any playing song to add it here.</div>`;
    }

    html += `</div></div>`;

    // Imported Playlists section
    html += `
      <div class="shelf">
        <div class="shelf-title">Playlists & Imported Mixes (${importedPlaylists.length})</div>
        <div class="shelf-track-container">
    `;

    // Render user imported playlists
    if (importedPlaylists.length > 0) {
      importedPlaylists.forEach(pl => {
        html += `
          <div class="media-card focusable" tabindex="0" data-imported-id="${pl.id}">
            <div class="media-card-artwork"><img src="${pl.artwork || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}"/></div>
            <div class="media-card-title">${pl.title}</div>
            <div class="media-card-author">${pl.tracks ? pl.tracks.length : 0} Tracks • ${pl.source || 'Imported'}</div>
          </div>
        `;
      });
    } else {
      html += `<div style="padding: 24px; color: var(--text-dim); font-size: 15px;">No imported playlists yet. Click "Import Now" above or scan on your phone to add playlists!</div>`;
    }

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;

    const promoBanner = container.querySelector('#banner-import-playlist');
    if (promoBanner) {
      promoBanner.addEventListener('click', () => {
        this.openImportModal();
      });
    }

    // Attach listeners
    container.querySelectorAll('.recognized-track-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        const track = favorites.find(t => t.id === id);
        if (track) {
          window.Queue.setQueue([track]);
          window.AudioPlayer.playTrack(track);
          this.openFullscreenPlayer();
        }
      });
    });

    container.querySelectorAll('[data-imported-id]').forEach(card => {
      card.addEventListener('click', () => {
        const plId = card.getAttribute('data-imported-id');
        const pl = importedPlaylists.find(p => p.id === plId);
        if (pl && pl.tracks && pl.tracks.length > 0) {
          window.Queue.setQueue(pl.tracks, 0);
          window.AudioPlayer.playTrack(pl.tracks[0]);
          this.openFullscreenPlayer();
          this.showToast(`▶️ Playing "${pl.title}" (${pl.tracks.length} songs)`);
        }
      });
    });
  }

  // --- 5. Mini Player & Fullscreen ---
  setupMiniPlayer() {
    const mini = document.getElementById('mini-player');
    if (mini) {
      mini.addEventListener('click', (e) => {
        if (!e.target.closest('.mini-control-btn')) {
          this.openFullscreenPlayer();
        }
      });
    }

    const playPauseBtn = document.getElementById('mini-play-pause-btn');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.AudioPlayer.togglePlayPause();
      });
    }

    const nextBtn = document.getElementById('mini-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.AudioPlayer.playNext();
      });
    }
  }

  setupFullscreenPlayer() {
    const playPauseBtn = document.getElementById('fs-play-pause-btn');
    if (playPauseBtn) playPauseBtn.addEventListener('click', () => window.AudioPlayer.togglePlayPause());

    const prevBtn = document.getElementById('fs-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => window.AudioPlayer.playPrevious());

    const nextBtn = document.getElementById('fs-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => window.AudioPlayer.playNext());

    const shuffleBtn = document.getElementById('fs-shuffle-btn');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => {
        const isShuffled = window.Queue.toggleShuffle();
        this.showToast(isShuffled ? 'Shuffle: ON' : 'Shuffle: OFF');
      });
    }

    const repeatBtn = document.getElementById('fs-repeat-btn');
    if (repeatBtn) {
      repeatBtn.addEventListener('click', () => {
        const mode = window.Queue.toggleRepeat();
        this.showToast(`Repeat: ${mode.toUpperCase()}`);
      });
    }

    const scrubber = document.getElementById('player-scrubber-track');
    if (scrubber) {
      scrubber.addEventListener('click', (e) => {
        const rect = scrubber.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        if (!isNaN(window.AudioPlayer.audio.duration)) {
          window.AudioPlayer.seek(ratio * window.AudioPlayer.audio.duration);
        }
      });
    }

    // Favorite button
    const favBtn = document.getElementById('btn-fav-track');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        if (window.AudioPlayer.currentTrack) {
          const isLiked = window.Library.toggleFavorite(window.AudioPlayer.currentTrack);
          favBtn.querySelector('svg').style.fill = isLiked ? '#ff2a6d' : 'currentColor';
        }
      });
    }

    // Queue / Up Next Toggle
    const queueBtn = document.getElementById('btn-toggle-queue');
    if (queueBtn) {
      queueBtn.addEventListener('click', () => {
        this.showingQueue = !this.showingQueue;
        const lyricsContainer = document.getElementById('lyrics-container');
        const queueContainer = document.getElementById('player-queue-container');

        if (this.showingQueue) {
          if (lyricsContainer) lyricsContainer.style.display = 'none';
          if (queueContainer) {
            queueContainer.style.display = 'block';
            this.renderPlayerQueue();
          }
          this.showToast('Showing Up Next Queue');
        } else {
          if (lyricsContainer) lyricsContainer.style.display = 'flex';
          if (queueContainer) queueContainer.style.display = 'none';
          this.showToast('Showing Lyrics');
        }
      });
    }

    // Party Jukebox Button in Player
    const partyPlayerBtn = document.getElementById('btn-party-jukebox');
    if (partyPlayerBtn) {
      partyPlayerBtn.addEventListener('click', () => {
        this.openPartyModal();
      });
    }

    // Visualizer Toggle Button
    const vizBtn = document.getElementById('btn-toggle-visualizer');
    if (vizBtn) {
      vizBtn.addEventListener('click', () => {
        this.toggleVisualizer();
      });
    }

    // Dual-Script Toggle Button
    const dualLyricsBtn = document.getElementById('btn-toggle-dual-lyrics');
    if (dualLyricsBtn) {
      dualLyricsBtn.addEventListener('click', () => {
        this.toggleDualLyrics();
      });
    }

    // Karaoke Sing-Along Stage Button
    const karaokeBtn = document.getElementById('btn-karaoke-stage');
    if (karaokeBtn) {
      karaokeBtn.addEventListener('click', () => {
        this.toggleKaraokeStage();
      });
    }

    const exitKaraokeBtn = document.getElementById('btn-exit-karaoke');
    if (exitKaraokeBtn) {
      exitKaraokeBtn.addEventListener('click', () => {
        this.toggleKaraokeStage(false);
      });
    }

    // Wireless Mic Button in Player & Karaoke Banner
    const micBtn = document.getElementById('btn-wireless-mic');
    if (micBtn) {
      micBtn.addEventListener('click', () => {
        this.openMicModal();
      });
    }

    const karaokeMicBtn = document.getElementById('btn-karaoke-connect-mic');
    if (karaokeMicBtn) {
      karaokeMicBtn.addEventListener('click', () => {
        this.openMicModal();
      });
    }

    // Settings Button in Player
    const playerSettingsBtn = document.getElementById('btn-player-settings') || document.getElementById('btn-tweaks-track');
    if (playerSettingsBtn) {
      playerSettingsBtn.addEventListener('click', () => {
        this.closeFullscreenPlayer();
        this.switchView('settings');
      });
    }

    // Attach TV Button Preview HUD
    this.setupButtonPreviews();
  }

  setupButtonPreviews() {
    const previewMap = {
      'fs-play-pause-btn': 'Play / Pause',
      'fs-prev-btn': 'Previous',
      'fs-next-btn': 'Next',
      'fs-shuffle-btn': 'Shuffle',
      'fs-repeat-btn': 'Repeat',
      'btn-karaoke-stage': 'Vocals Mode',
      'btn-wireless-mic': 'Wireless Mic',
      'btn-karaoke-connect-mic': 'Phone Mic',
      'btn-open-importer': 'Import Playlist',
      'btn-toggle-visualizer': 'Visualizer',
      'btn-toggle-dual-lyrics': 'Dual Script',
      'btn-party-jukebox': 'Party Jukebox',
      'btn-fav-track': 'Favorite',
      'btn-toggle-queue': 'Queue',
      'btn-player-settings': 'Audio FX',
      'player-scrubber-track': 'Seek',
      'btn-exit-karaoke': 'Exit Vocals Mode'
    };

    Object.keys(previewMap).forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('focus', () => {
          if (window.SpatialNav) window.SpatialNav.showButtonFocusLabel(btn);
        });
        btn.addEventListener('mouseenter', () => {
          if (window.SpatialNav) window.SpatialNav.showButtonFocusLabel(btn);
        });
      }
    });
  }

  renderPlayerQueue() {
    const list = document.getElementById('player-queue-list');
    if (!list) return;

    const tracks = window.Queue.tracks;
    const currentIdx = window.Queue.currentIndex;

    list.innerHTML = '';
    tracks.forEach((t, idx) => {
      const row = document.createElement('div');
      row.className = `recognized-track-row focusable ${idx === currentIdx ? 'active' : ''}`;
      row.setAttribute('tabindex', '0');
      row.innerHTML = `
        <div class="recognized-artwork"><img src="${t.artwork}"/></div>
        <div class="recognized-info">
          <div class="recognized-track-title">${idx === currentIdx ? '▶ ' : ''}${t.title}</div>
          <div class="recognized-track-sub">${t.artist}</div>
        </div>
      `;

      row.addEventListener('click', () => {
        window.Queue.currentIndex = idx;
        window.AudioPlayer.playTrack(t);
      });

      list.appendChild(row);
    });
  }

  // --- Audio Visualizer & Dual Script Controllers ---
  setupVisualizer() {
    try {
      this.visualizerCanvas = document.getElementById('player-visualizer-canvas');
      if (this.visualizerCanvas && this.visualizerCanvas.getContext) {
        this.visualizerCtx = this.visualizerCanvas.getContext('2d');
      }
    } catch (e) {
      console.warn('Canvas context setup:', e);
    }
    this.isVisualizerActive = false;
  }

  toggleVisualizer() {
    this.isVisualizerActive = !this.isVisualizerActive;
    const btn = document.getElementById('btn-toggle-visualizer');
    if (btn) btn.classList.toggle('active', this.isVisualizerActive);
    if (this.visualizerCanvas) this.visualizerCanvas.classList.toggle('active', this.isVisualizerActive);

    if (this.isVisualizerActive) {
      this.showToast('Audio Visualizer Activated');
      this.runVisualizerLoop();
    } else {
      this.showToast('Visualizer Hidden');
    }
  }

  runVisualizerLoop() {
    if (!this.isVisualizerActive) return;

    const draw = () => {
      if (!this.isVisualizerActive) return;

      const fsPlayer = document.getElementById('fullscreen-player');
      if (!fsPlayer || !fsPlayer.classList.contains('active')) {
        requestAnimationFrame(draw);
        return;
      }

      const ctx = this.visualizerCtx;
      const canvas = this.visualizerCanvas;
      if (!ctx || !canvas) return;

      const data = window.AudioDSP ? window.AudioDSP.getFrequencyData() : null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (data && data.length > 0 && window.AudioPlayer && window.AudioPlayer.isPlaying) {
        const bars = 20;
        const barWidth = 12;
        const spacing = (canvas.width - (bars * barWidth)) / (bars + 1);
        const centerY = canvas.height / 2;

        for (let i = 0; i < bars; i++) {
          const val = data[i] || 0;
          const barHeight = Math.max(8, (val / 255) * 160);
          const x = spacing + i * (barWidth + spacing);
          const y = centerY - barHeight / 2;

          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.5, '#ff2a6d');
          grad.addColorStop(1, '#8a2387');

          ctx.fillStyle = grad;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, 5);
          } else {
            ctx.rect(x, y, barWidth, barHeight);
          }
          ctx.fill();
        }
      }

      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
  }

  setupDualScriptToggle() {
    this.isDualScriptActive = false;
  }

  toggleDualLyrics() {
    this.isDualScriptActive = !this.isDualScriptActive;
    const btn = document.getElementById('btn-toggle-dual-lyrics');
    if (btn) btn.classList.toggle('active', this.isDualScriptActive);
    this.showToast(this.isDualScriptActive ? 'Dual-Script Sing-Along Active' : 'Standard Lyrics View');
    this.renderLyrics(window.AudioPlayer?.currentLyrics || []);
  }

  transliterateDevanagariToLatin(text) {
    if (!text) return '';
    if (!/[\u0900-\u097F]/.test(text)) return '';

    const vowels = {
      'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
      'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'am', 'अः': 'ah',
      'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
      'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': ''
    };

    const consonants = {
      'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
      'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
      'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
      'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
      'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
      'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
      'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
      'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'ज़': 'z', 'क़': 'q', 'ख़': 'kh', 'ग़': 'gh'
    };

    let result = '';
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (consonants[ch]) {
        result += consonants[ch];
        const next = chars[i + 1];
        if (!next || (!vowels[next] && next !== '्' && !consonants[next])) {
          result += 'a';
        } else if (consonants[next]) {
          result += 'a';
        }
      } else if (vowels[ch]) {
        result += vowels[ch];
      } else {
        result += ch;
      }
    }
    return result.replace(/\s+/g, ' ').trim();
  }

  // --- 6. Apple-Style Word-Synced Lyrics Renderer (am-lyrics) ---
  processLyricsWithInstrumentals(rawLyrics, currentTrack = null) {
    if (!rawLyrics || rawLyrics.length === 0) return [];
    const processed = [];

    const artistStr = (currentTrack?.artist || '').toLowerCase();
    const isCollab = artistStr.includes('&') || artistStr.includes(',') || artistStr.includes('feat.') || artistStr.includes('ft.');

    // 1. Intro Instrumental: if first line starts after 4.0 seconds
    if (rawLyrics[0].time > 4.0) {
      processed.push({
        time: 0,
        isInstrumental: true,
        text: '🎶 🎶 🎶'
      });
    }

    let activeSingerRole = 'lead';

    for (let i = 0; i < rawLyrics.length; i++) {
      const item = { ...rawLyrics[i] };
      let text = item.text || '';
      let singerRole = 'lead';
      let singerName = '';

      // Check explicit speaker/singer pattern: [Singer]: or (Singer): or Singer:
      const tagMatch = text.match(/^\[([a-zA-Z0-9\s]+)\]:?\s*/i) ||
                       text.match(/^\(([a-zA-Z0-9\s]{2,16})\):?\s*/i) ||
                       text.match(/^([a-zA-Z0-9\s]{2,16}):\s+/i);

      if (tagMatch) {
        const rawTag = tagMatch[1].trim();
        const lowerTag = rawTag.toLowerCase();
        const skipWords = ['verse', 'chorus', 'intro', 'outro', 'hook', 'bridge', 'instrumental', 'music', 'tune'];
        if (!skipWords.some(w => lowerTag.startsWith(w))) {
          singerName = rawTag;
          text = text.slice(tagMatch[0].length).trim();
          item.text = text;
          if (lowerTag.includes('female') || lowerTag.includes('2') || lowerTag.includes('guest') || lowerTag.includes('woman') || lowerTag.includes('her')) {
            singerRole = 'duet';
          } else if (lowerTag.includes('male') || lowerTag.includes('1') || lowerTag.includes('lead')) {
            singerRole = 'lead';
          } else {
            singerRole = 'duet';
          }
        }
      } else if (text.startsWith('(') && text.endsWith(')') && text.length > 2) {
        // Parenthetical backing / harmony vocals
        singerRole = 'backing';
      } else if (isCollab) {
        // Alternating vocalist switch on long pause
        if (i > 0 && rawLyrics[i].time - rawLyrics[i - 1].time > 5.5) {
          activeSingerRole = (activeSingerRole === 'lead' ? 'duet' : 'lead');
        }
        singerRole = activeSingerRole;
      }

      item.singerRole = singerRole;
      if (singerName) item.singerName = singerName;

      processed.push(item);

      // 2. Interlude Instrumental: if gap between lines > 6.0 seconds
      if (i < rawLyrics.length - 1) {
        const gap = rawLyrics[i + 1].time - rawLyrics[i].time;
        if (gap > 6.0) {
          processed.push({
            time: rawLyrics[i].time + 3.2,
            isInstrumental: true,
            text: '🎶 🎶 🎶'
          });
        }
      }
    }

    return processed;
  }

  renderLyrics(lyrics) {
    this.updateSyncDisplay();
    const container = document.getElementById('lyrics-container');
    if (!container) return;

    if (!lyrics || lyrics.length === 0) {
      container.innerHTML = '<div style="color: var(--text-dim); font-size: 26px; padding: 40px 0;">Instrumental track / No lyrics available.</div>';
      return;
    }

    // Process lyrics to insert Apple Music style instrumental interludes & duet color coding
    const track = window.AudioPlayer?.currentTrack;
    const processedLyrics = this.processLyricsWithInstrumentals(lyrics, track);
    if (window.AudioPlayer) {
      window.AudioPlayer.currentLyrics = processedLyrics;
    }
    this.activeLyricIndex = -1;

    container.innerHTML = '';
    const scrollTrack = document.createElement('div');
    scrollTrack.id = 'lyrics-scroll-track';
    scrollTrack.className = 'lyrics-scroll-track';

    processedLyrics.forEach((line, lineIdx) => {
      const lineElem = document.createElement('div');
      lineElem.setAttribute('tabindex', '0');
      lineElem.setAttribute('data-line', lineIdx);

      if (line.isInstrumental) {
        lineElem.className = 'lrc-line lrc-instrumental focusable';
        lineElem.innerHTML = `
          <div class="instrumental-capsule">
            <span class="note-dot note-1">🎶</span>
            <span class="note-dot note-2">🎶</span>
            <span class="note-dot note-3">🎶</span>
          </div>
        `;
      } else {
        const singerClass = line.singerRole ? `singer-${line.singerRole}` : 'singer-lead';
        lineElem.className = `lrc-line focusable ${singerClass}`;

        if (line.singerName) {
          const badge = document.createElement('span');
          badge.className = 'singer-badge';
          badge.textContent = line.singerName;
          lineElem.appendChild(badge);
        }

        // Render each word
        if (line.words && line.words.length > 0) {
          line.words.forEach((w) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'lrc-word';
            wordSpan.setAttribute('data-word-time', w.time);
            wordSpan.textContent = w.text;
            lineElem.appendChild(wordSpan);
          });
        } else {
          const textNode = document.createTextNode(line.text);
          lineElem.appendChild(textNode);
        }

        // Dual-Script / Romanized sing-along subtitle if toggled on
        if (this.isDualScriptActive && line.text) {
          const romanized = this.transliterateDevanagariToLatin(line.text);
          if (romanized) {
            const dualDiv = document.createElement('div');
            dualDiv.className = 'lrc-dual-script';
            dualDiv.textContent = romanized;
            lineElem.appendChild(dualDiv);
          }
        }
      }

      lineElem.addEventListener('click', () => {
        if (window.AudioPlayer) window.AudioPlayer.seek(line.time);
      });

      scrollTrack.appendChild(lineElem);
    });

    container.appendChild(scrollTrack);
  }

  updateWordLyrics(lyrics, currentTime) {
    if (!lyrics || lyrics.length === 0) return;

    // Apply track-specific calibration offset + 180ms audio hardware lead-time
    const currentTrack = window.AudioPlayer ? window.AudioPlayer.currentTrack : null;
    const userOffset = this.getTrackLyricsOffset(currentTrack);
    const calibratedTime = Math.max(0, currentTime + userOffset + 0.18);

    // Fast-find active line index
    let activeLineIdx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (calibratedTime >= lyrics[i].time) {
        activeLineIdx = i;
      } else {
        break;
      }
    }

    const container = document.getElementById('lyrics-container');
    if (!container) return;

    if (this.activeLyricIndex !== activeLineIdx) {
      const prevIdx = this.activeLyricIndex;
      this.activeLyricIndex = activeLineIdx;

      if (prevIdx !== -1) {
        const prevLine = container.querySelector(`.lrc-line[data-line="${prevIdx}"]`);
        if (prevLine) {
          prevLine.classList.remove('active');
          const oldBall = prevLine.querySelector('.vocal-sing-ball');
          if (oldBall) oldBall.remove();
        }
      }

      if (activeLineIdx !== -1) {
        const currLine = container.querySelector(`.lrc-line[data-line="${activeLineIdx}"]`);
        if (currLine) {
          currLine.classList.add('active');

          // Apple Music stepped visual depth
          container.querySelectorAll('.lrc-line.nearby').forEach(el => el.classList.remove('nearby'));
          const nextLine = container.querySelector(`.lrc-line[data-line="${activeLineIdx + 1}"]`);
          const prevAdjacent = container.querySelector(`.lrc-line[data-line="${activeLineIdx - 1}"]`);
          if (nextLine) nextLine.classList.add('nearby');
          if (prevAdjacent) prevAdjacent.classList.add('nearby');

          // Attach Apple Music Sing Bouncing Rhythm Guide Ball if Vocals/Karaoke active
          const isKaraoke = this.isKaraokeActive || (window.AudioDSP && window.AudioDSP.karaokeEnabled);
          if (isKaraoke && !currLine.querySelector('.vocal-sing-ball') && !currLine.classList.contains('lrc-instrumental')) {
            const ball = document.createElement('div');
            ball.className = 'vocal-sing-ball';
            currLine.appendChild(ball);
          }

          // 60fps GPU Hardware-Accelerated Smooth Scroll
          const scrollTrack = document.getElementById('lyrics-scroll-track');
          if (scrollTrack) {
            const targetY = -Math.max(0, currLine.offsetTop - 140);
            scrollTrack.style.transform = `translate3d(0, ${targetY}px, 0)`;
          }
        }
      }
    }

    // Dynamic Syllable / Word Pacing Guide for active line
    if (activeLineIdx !== -1) {
      const currLine = container.querySelector(`.lrc-line[data-line="${activeLineIdx}"]`);
      if (currLine && !currLine.classList.contains('lrc-instrumental')) {
        const ball = currLine.querySelector('.vocal-sing-ball');
        const words = currLine.querySelectorAll('.lrc-word');
        if (words && words.length > 0) {
          let activeWordEl = null;
          words.forEach(w => {
            const wTime = parseFloat(w.getAttribute('data-word-time') || 0);
            if (calibratedTime >= wTime) {
              w.classList.add('sung');
              activeWordEl = w;
            } else {
              w.classList.remove('sung');
            }
          });
          if (ball && activeWordEl) {
            ball.style.left = (activeWordEl.offsetLeft + activeWordEl.offsetWidth / 2 - 7) + 'px';
          }
        } else if (ball) {
          const currTime = lyrics[activeLineIdx].time;
          const nextTime = lyrics[activeLineIdx + 1] ? lyrics[activeLineIdx + 1].time : currTime + 4.0;
          const duration = Math.max(0.8, nextTime - currTime);
          const progress = Math.min(1, Math.max(0, (calibratedTime - currTime) / duration));
          ball.style.left = Math.round(progress * Math.min(currLine.offsetWidth, 480)) + 'px';
        }
      }
    }
  }

  getTrackLyricsOffset(track) {
    if (!track) return 0;
    const key = `layatv_lyric_offset_${track.title}_${track.artist}`;
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? parseFloat(saved) : 0;
    } catch(e) {
      return 0;
    }
  }

  setTrackLyricsOffset(track, offset) {
    if (!track) return;
    const key = `layatv_lyric_offset_${track.title}_${track.artist}`;
    const rounded = Math.round(offset * 10) / 10;
    try {
      localStorage.setItem(key, rounded);
    } catch(e) {}
    this.updateSyncDisplay(rounded);
  }

  updateSyncDisplay(offsetVal = null) {
    const track = window.AudioPlayer ? window.AudioPlayer.currentTrack : null;
    const offset = offsetVal !== null ? offsetVal : this.getTrackLyricsOffset(track);
    const disp = document.getElementById('sync-offset-display');
    if (disp) {
      const sign = offset > 0 ? '+' : '';
      disp.textContent = `Sync: ${sign}${offset.toFixed(1)}s`;
      disp.style.color = offset === 0 ? '#4ade80' : '#ffaa00';
    }
  }

  setupLyricsSyncControls() {
    const btnEarlier = document.getElementById('btn-sync-earlier');
    if (btnEarlier) {
      btnEarlier.addEventListener('click', () => {
        const track = window.AudioPlayer ? window.AudioPlayer.currentTrack : null;
        if (!track) return;
        const current = this.getTrackLyricsOffset(track);
        const next = Math.round((current - 0.5) * 10) / 10;
        this.setTrackLyricsOffset(track, next);
        this.showToast(`⏱️ Lyrics Earlier: ${next > 0 ? '+' : ''}${next.toFixed(1)}s (Saved)`);
      });
    }

    const btnLater = document.getElementById('btn-sync-later');
    if (btnLater) {
      btnLater.addEventListener('click', () => {
        const track = window.AudioPlayer ? window.AudioPlayer.currentTrack : null;
        if (!track) return;
        const current = this.getTrackLyricsOffset(track);
        const next = Math.round((current + 0.5) * 10) / 10;
        this.setTrackLyricsOffset(track, next);
        this.showToast(`⏱️ Lyrics Later: ${next > 0 ? '+' : ''}${next.toFixed(1)}s (Saved)`);
      });
    }

    const btnReset = document.getElementById('btn-sync-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        const track = window.AudioPlayer ? window.AudioPlayer.currentTrack : null;
        if (!track) return;
        this.setTrackLyricsOffset(track, 0.0);
        this.showToast('⏱️ Lyrics Sync Reset to 0.0s');
      });
    }
  }

  refreshStatsTable() {
    if (!window.AudioDSP) return;
    const stats = window.AudioDSP.getStats();
    const codec = document.getElementById('stat-codec');
    if (codec) codec.textContent = stats.codec;
    const sr = document.getElementById('stat-sample-rate');
    if (sr) sr.textContent = `${stats.sampleRate} (${stats.latency} latency)`;
    const dsp = document.getElementById('stat-dsp');
    if (dsp) dsp.textContent = stats.dspActive;
  }

  openFullscreenPlayer() {
    const fsPlayer = document.getElementById('fullscreen-player');
    if (fsPlayer) {
      fsPlayer.classList.add('active');
      const favBtn = document.getElementById('btn-fav-track');
      if (favBtn && window.AudioPlayer.currentTrack) {
        const isLiked = window.Library.isFavorite(window.AudioPlayer.currentTrack.id);
        favBtn.querySelector('svg').style.fill = isLiked ? '#ff2a6d' : 'currentColor';
      }

      // Ensure lyrics container is visible and active (reset queue overlay)
      const lyricsContainer = document.getElementById('lyrics-container');
      const queueContainer = document.getElementById('player-queue-container');
      if (lyricsContainer) lyricsContainer.style.display = 'flex';
      if (queueContainer) queueContainer.style.display = 'none';
      this.showingQueue = false;

      // Always render current lyrics when opening player
      if (window.AudioPlayer && window.AudioPlayer.currentLyrics && window.AudioPlayer.currentLyrics.length > 0) {
        this.renderLyrics(window.AudioPlayer.currentLyrics);
      }

      const playBtn = document.getElementById('fs-play-pause-btn');
      if (playBtn && window.SpatialNav) {
        window.SpatialNav.setFocus(playBtn);
      }
    }
  }

  closeFullscreenPlayer() {
    const fsPlayer = document.getElementById('fullscreen-player');
    if (fsPlayer) {
      fsPlayer.classList.remove('active');
      const mini = document.getElementById('mini-player');
      if (mini && window.SpatialNav) {
        window.SpatialNav.setFocus(mini);
      }
    }
  }

  renderSettings() {
    const activeVerElem = document.getElementById('settings-active-version');
    if (activeVerElem && window.Updater) {
      activeVerElem.textContent = `v${window.Updater.activeVersion}`;
    }

    const checkBtn = document.getElementById('btn-check-updates');
    if (checkBtn && !checkBtn._bound) {
      checkBtn._bound = true;
      checkBtn.addEventListener('click', () => window.Updater.checkForUpdates(true));
    }

    const resetBtn = document.getElementById('btn-reset-factory');
    if (resetBtn && !resetBtn._bound) {
      resetBtn._bound = true;
      resetBtn.addEventListener('click', () => window.Updater.resetToFactory());
    }

    // Reverb Preset Buttons
    const reverbBtns = document.querySelectorAll('#view-settings [data-reverb]');
    reverbBtns.forEach(btn => {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', () => {
          const preset = btn.getAttribute('data-reverb');
          if (window.AudioDSP) {
            window.AudioDSP.setReverbPreset(preset);
            const label = document.getElementById('reverb-status-label');
            if (label) label.textContent = preset.toUpperCase();
            reverbBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.showToast(`Reverb preset: ${preset.toUpperCase()}`);
            this.refreshStatsTable();
          }
        });
      }
    });

    // Playback Speed Buttons
    const speedBtns = document.querySelectorAll('#view-settings [data-speed]');
    speedBtns.forEach(btn => {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', () => {
          const spd = parseFloat(btn.getAttribute('data-speed'));
          if (window.AudioDSP) {
            window.AudioDSP.setPlaybackSpeed(spd);
            speedBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.showToast(`Playback speed: ${spd}×`);
            this.refreshStatsTable();
          }
        });
      }
    });

    this.refreshStatsTable();
  }

  // =====================================================================
  // FEATURE 1: PARTY JUKEBOX (FROSTED GLASS QR QUEUE)
  // =====================================================================
  setupPartyJukebox() {
    const closeBtn = document.getElementById('btn-close-party');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closePartyModal();
      });
    }

    const simBtn = document.getElementById('btn-simulate-guest-add');
    if (simBtn) {
      simBtn.addEventListener('click', () => {
        const guestTracks = [
          { id: 'party_blinding', title: 'Blinding Lights', artist: 'The Weeknd', artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80', durationFormatted: '3:20' },
          { id: 'party_levitating', title: 'Levitating', artist: 'Dua Lipa', artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80', durationFormatted: '3:23' },
          { id: 'party_starboy', title: 'Starboy', artist: 'The Weeknd', artwork: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80', durationFormatted: '3:50' }
        ];
        const pick = guestTracks[Math.floor(Math.random() * guestTracks.length)];
        this.handleGuestSongArrival(pick);
      });
    }

    // Real-Time Cross-Window / Mobile Broadcast Channel Listener
    try {
      this.partyChannel = new BroadcastChannel('laya_party_jukebox');
      this.partyChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'ADD_GUEST_TRACK' && event.data.track) {
          this.handleGuestSongArrival(event.data.track);
        }
      };
    } catch (e) {
      console.warn('[PartyJukebox] BroadcastChannel not supported in this runtime');
    }

    // Fallback polling on local storage for cross-device mobile queue
    setInterval(() => {
      try {
        const raw = localStorage.getItem('laya_guest_incoming_track');
        if (raw) {
          const payload = JSON.parse(raw);
          if (payload && payload.track && (!this.lastProcessedGuestTime || payload.time > this.lastProcessedGuestTime)) {
            this.lastProcessedGuestTime = payload.time;
            this.handleGuestSongArrival(payload.track);
          }
        }
      } catch (err) {}
    }, 2000);
  }

  openPartyModal() {
    const modal = document.getElementById('party-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.classList.add('active');

    // Update Room Badge and URL
    const code = this.getTVRoomCode();
    const tag = document.getElementById('tv-room-code-tag');
    if (tag) tag.textContent = `ROOM: ${code}`;

    const partyUrl = this.getPublicMobileUrl('party.html');
    const urlText = document.getElementById('party-url-text');
    if (urlText) urlText.textContent = partyUrl;

    // Generate crisp vector QR Code into target container
    const qrTarget = document.getElementById('party-qr-target');
    if (qrTarget && window.generateQRCodeSVG) {
      try {
        qrTarget.innerHTML = window.generateQRCodeSVG(partyUrl, 236);
      } catch (err) {
        console.warn('QR Code generation error:', err);
      }
    }

    setTimeout(() => {
      const focusTarget = document.getElementById('btn-simulate-guest-add') || document.getElementById('btn-close-party') || modal.querySelector('.focusable');
      if (focusTarget && window.SpatialNav) {
        window.SpatialNav.setFocus(focusTarget);
      }
    }, 60);
  }

  closePartyModal() {
    const modal = document.getElementById('party-modal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';

    if (window.SpatialNav) {
      const partyBtn = document.getElementById('btn-header-party');
      if (partyBtn) {
        window.SpatialNav.setFocus(partyBtn);
      } else {
        window.SpatialNav.validateFocus();
      }
    }
  }

  togglePartyModal() {
    const modal = document.getElementById('party-modal');
    if (modal && (modal.classList.contains('active') || modal.style.display === 'flex')) {
      this.closePartyModal();
    } else {
      this.openPartyModal();
    }
  }

  handleGuestSongArrival(track) {
    if (!track) return;
    if (window.Queue) {
      window.Queue.addTrack(track);
    }
    this.showToast(`🎉 Guest added "${track.title}" to Up Next!`);
    
    // If nothing currently playing, start playing guest's song
    if (window.AudioPlayer && (!window.AudioPlayer.currentTrack || window.AudioPlayer.audio.paused)) {
      window.AudioPlayer.playTrack(track);
    }
  }

  // =====================================================================
  // FEATURE 2: AMBIENT CINEMA SCREENSAVER MODE
  // =====================================================================
  setupScreensaver() {
    const resetActivity = () => {
      if (this.isScreensaverActive) {
        this.exitScreensaver();
      }
      this.resetScreensaverTimer();
    };

    window.addEventListener('keydown', resetActivity, true);
    window.addEventListener('mousemove', resetActivity, true);
    window.addEventListener('click', resetActivity, true);

    this.resetScreensaverTimer();
  }

  resetScreensaverTimer() {
    if (this.screensaverTimer) {
      clearTimeout(this.screensaverTimer);
    }
    // Idle 35 seconds to enter screensaver
    this.screensaverTimer = setTimeout(() => {
      this.checkAndEnterScreensaver();
    }, 35000);
  }

  checkAndEnterScreensaver() {
    const fsPlayer = document.getElementById('fullscreen-player');
    const isPlaying = window.AudioPlayer && window.AudioPlayer.currentTrack && !window.AudioPlayer.audio.paused;

    // Only engage screensaver if music is actively playing in fullscreen view
    if (fsPlayer && fsPlayer.classList.contains('active') && isPlaying && !this.isKaraokeActive) {
      this.enterScreensaver();
    } else {
      this.resetScreensaverTimer();
    }
  }

  enterScreensaver() {
    const fsPlayer = document.getElementById('fullscreen-player');
    if (!fsPlayer) return;

    this.isScreensaverActive = true;
    fsPlayer.classList.add('cinema-screensaver');
    this.updateScreensaverClock();
    console.log('[Screensaver] Cinema screensaver activated');
  }

  updateScreensaverClock() {
    const clockEl = document.getElementById('screensaver-clock-text');
    if (clockEl) {
      const now = new Date();
      let hours = now.getHours();
      const mins = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      clockEl.textContent = `${hours}:${mins} ${ampm}`;
    }
  }

  exitScreensaver() {
    const fsPlayer = document.getElementById('fullscreen-player');
    if (fsPlayer) {
      fsPlayer.classList.remove('cinema-screensaver');
    }
    this.isScreensaverActive = false;
    this.resetScreensaverTimer();
  }

  // =====================================================================
  // FEATURE 3: FULL-SCREEN KARAOKE PARTY STAGE
  // =====================================================================
  setupKaraokeStage() {
    // Handled in setupFullscreenPlayer via button listeners
  }

  toggleKaraokeStage(forceState = null) {
    const fsPlayer = document.getElementById('fullscreen-player');
    if (!fsPlayer) return;

    if (forceState !== null) {
      this.isKaraokeActive = forceState;
    } else {
      this.isKaraokeActive = !this.isKaraokeActive;
    }

    if (window.AudioDSP) {
      if (window.AudioDSP.karaokeEnabled !== this.isKaraokeActive) {
        window.AudioDSP.toggleKaraoke();
      }
    }

    const karaokeBtn = document.getElementById('btn-karaoke-stage');
    if (karaokeBtn) {
      karaokeBtn.classList.toggle('active', this.isKaraokeActive);
    }

    if (this.isKaraokeActive) {
      // Exit screensaver if active
      this.exitScreensaver();
      fsPlayer.classList.add('karaoke-stage-active');
      this.renderKaraokeOnscreenQR();
      this.showToast('🎤 Vocals Mode Active: Scan QR code on screen to sing live!');
      
      const exitBtn = document.getElementById('btn-exit-karaoke');
      if (exitBtn && window.SpatialNav) {
        window.SpatialNav.setFocus(exitBtn);
      }
    } else {
      fsPlayer.classList.remove('karaoke-stage-active');
      document.querySelectorAll('.vocal-sing-ball').forEach(b => b.remove());
      this.showToast('Vocals Mode Turned Off');
    }
  }

  getTVRoomCode() {
    if (!this.roomCode) {
      let saved = localStorage.getItem('layatv_stable_room_code');
      if (!saved) {
        saved = '' + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem('layatv_stable_room_code', saved);
      }
      this.roomCode = saved;
    }
    return this.roomCode;
  }

  getPublicMobileUrl(page) {
    const code = this.getTVRoomCode();
    const origin = window.location.origin;
    if (origin && origin.startsWith('http') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return `${origin}/${page}?room=${code}`;
    }
    return `https://ayush019z.github.io/laya-tizen/${page}?room=${code}`;
  }

  renderKaraokeOnscreenQR() {
    this.ensureDynamicDOM();
    const qrTarget = document.getElementById('karaoke-onscreen-qr');
    if (!qrTarget) return;

    const micUrl = this.getPublicMobileUrl('mic.html');
    if (window.generateQRCodeSVG) {
      try {
        qrTarget.innerHTML = window.generateQRCodeSVG(micUrl, 175);
      } catch (err) {
        console.warn('On-screen QR generation error:', err);
      }
    }
  }

  // =====================================================================
  // FEATURE 3: PHONE AS WIRELESS KARAOKE MICROPHONE
  // =====================================================================
  setupWirelessMic() {
    const closeBtn = document.getElementById('btn-close-mic');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeMicModal());
    }

    const testBtn = document.getElementById('btn-toggle-mic-test');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
              if (window.AudioDSP) {
                window.AudioDSP.attachMicrophoneStream(stream);
                this.showToast('🎙️ Live Microphone Input Attached to TV!');
              }
            })
            .catch(err => {
              console.warn('TV Mic access error:', err);
              this.showToast('ℹ️ TV Mic requires USB / Bluetooth Mic or Phone link');
            });
        } else {
          this.showToast('ℹ️ Open mic.html on your phone to stream voice');
        }
      });
    }

    const echoBtn = document.getElementById('btn-mic-echo-toggle');
    if (echoBtn) {
      echoBtn.addEventListener('click', () => {
        if (window.AudioDSP) {
          const current = window.AudioDSP.micEchoGain ? window.AudioDSP.micEchoGain.gain.value : 0;
          const nextVal = current > 0.05 ? 0.0 : 0.45;
          window.AudioDSP.setMicEcho(nextVal);
          const echoStatus = document.getElementById('tv-mic-echo-status');
          if (echoStatus) echoStatus.textContent = nextVal > 0 ? 'ON (160ms)' : 'OFF';
          this.showToast(`Concert Echo: ${nextVal > 0 ? 'ON' : 'OFF'}`);
        }
      });
    }
  }

  // =====================================================================
  // FEATURE 4: REAL-TIME PHONE <-> TV REMOTE BRIDGE (WebSockets / MQTT)
  // =====================================================================
  setupRemoteBridge() {
    const code = this.getTVRoomCode();
    console.log('[RemoteBridge] Initializing TV Remote Bridge for room:', code);

    if (window.RemoteBridge) {
      window.RemoteBridge.initTV(code, (data) => {
        this.handleRemoteMessage(data, code);
      });
    }
  }

  handleRemoteMessage(data, code) {
    if (!data || !data.type) return;

    if (data.type === 'PHONE_HELLO' || data.type === 'MIC_PING') {
      const statusPill = document.getElementById('mic-connection-status');
      const statusText = document.getElementById('mic-status-text');
      const onscreenPill = document.getElementById('karaoke-onscreen-status-pill');
      const onscreenText = document.getElementById('karaoke-onscreen-status-text');

      if (statusPill) {
        statusPill.className = 'mic-status-pill connected';
        if (statusText) statusText.textContent = 'Phone Mic Connected (Live)';
      }
      if (onscreenPill) {
        onscreenPill.className = 'karaoke-mic-status-pill connected';
        if (onscreenText) onscreenText.textContent = 'Phone Mic Connected (Live)';
      }

      this.showToast('🎙️ Phone Connected to TV!');

      // Send ACK back to phone via WebSocket!
      if (window.RemoteBridge) {
        window.RemoteBridge.send({
          type: 'TV_ACK',
          room: code,
          status: 'CONNECTED',
          time: Date.now()
        });
      }
    } else if (data.type === 'MIC_STATE') {
      const statusPill = document.getElementById('mic-connection-status');
      const statusText = document.getElementById('mic-status-text');
      const onscreenPill = document.getElementById('karaoke-onscreen-status-pill');
      const onscreenText = document.getElementById('karaoke-onscreen-status-text');

      if (data.active) {
        if (statusPill) {
          statusPill.className = 'mic-status-pill connected';
          if (statusText) statusText.textContent = '🔴 Phone Singing Live!';
        }
        if (onscreenPill) {
          onscreenPill.className = 'karaoke-mic-status-pill connected';
          if (onscreenText) onscreenText.textContent = '🔴 Phone Singing Live!';
        }
      } else {
        if (statusPill) {
          statusPill.className = 'mic-status-pill';
          if (statusText) statusText.textContent = 'Phone Muted (Ready)';
        }
        if (onscreenPill) {
          onscreenPill.className = 'karaoke-mic-status-pill';
          if (onscreenText) onscreenText.textContent = 'Phone Muted (Ready)';
        }
      }

      if (window.AudioDSP) {
        if (data.volume !== undefined && window.AudioDSP.micGain) {
          window.AudioDSP.micGain.gain.value = data.volume;
        }
        if (data.echo !== undefined) {
          window.AudioDSP.setMicEcho(data.echo);
        }
      }
    } else if (data.type === 'PLAYLIST_IMPORT') {
      if (data.content) {
        this.showToast('📲 Received playlist link from phone! Importing...');
        const input = document.getElementById('import-url-input');
        if (input) input.value = data.content;
        this.executePlaylistImport();

        if (window.RemoteBridge) {
          window.RemoteBridge.send({
            type: 'IMPORT_ACK',
            status: 'IMPORTING',
            room: code,
            time: Date.now()
          });
        }
      }
    } else if (data.type === 'ADD_GUEST_TRACK') {
      if (data.track) {
        this.handleGuestSongArrival(data.track);
        if (window.RemoteBridge) {
          window.RemoteBridge.send({
            type: 'QUEUE_ACK',
            status: 'QUEUED',
            room: code,
            time: Date.now()
          });
        }
      }
    }
  }

  openMicModal() {
    this.ensureDynamicDOM();
    const modal = document.getElementById('mic-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.add('active');

    const qrTarget = document.getElementById('mic-qr-canvas');
    const micUrl = this.getPublicMobileUrl('mic.html');
    if (qrTarget && window.generateQRCodeSVG) {
      try {
        qrTarget.innerHTML = window.generateQRCodeSVG(micUrl, 236);
      } catch (e) {
        console.warn('QR code gen error:', e);
      }
    }

    setTimeout(() => {
      const focusTarget = document.getElementById('btn-toggle-mic-test') || document.getElementById('btn-close-mic') || modal.querySelector('.focusable');
      if (focusTarget && window.SpatialNav) {
        window.SpatialNav.setFocus(focusTarget);
      }
    }, 80);
  }

  closeMicModal() {
    const modal = document.getElementById('mic-modal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';

    if (window.SpatialNav) {
      const micBtn = document.getElementById('btn-wireless-mic') || document.getElementById('fs-play-pause-btn');
      if (micBtn) {
        window.SpatialNav.setFocus(micBtn);
      } else {
        window.SpatialNav.validateFocus();
      }
    }
  }

  // =====================================================================
  // FEATURE 5: INSTANT PLAYLIST IMPORTER
  // =====================================================================
  setupPlaylistImporter() {
    const openBtn = document.getElementById('btn-open-importer');
    if (openBtn) {
      openBtn.addEventListener('click', () => this.openImportModal());
    }

    const closeBtn = document.getElementById('btn-close-import');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeImportModal());
    }

    const execBtn = document.getElementById('btn-execute-import');
    if (execBtn) {
      execBtn.addEventListener('click', () => this.executePlaylistImport());
    }

    const sampleBtn = document.getElementById('btn-import-sample');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        const input = document.getElementById('import-url-input');
        if (input) {
          input.value = 'Arijit Singh - Kesariya\nDiljit Dosanjh - Lover\nBadshah - Jugnu\nShreya Ghoshal - Deewani Mastani\nAP Dhillon - With You';
          this.executePlaylistImport();
        }
      });
    }
  }

  openImportModal() {
    this.ensureDynamicDOM();
    const modal = document.getElementById('import-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.add('active');

    const qrTarget = document.getElementById('import-qr-canvas');
    const importUrl = this.getPublicMobileUrl('import.html');
    if (qrTarget && window.generateQRCodeSVG) {
      try {
        qrTarget.innerHTML = window.generateQRCodeSVG(importUrl, 236);
      } catch (e) {
        console.warn('QR code gen error:', e);
      }
    }

    setTimeout(() => {
      const input = document.getElementById('import-url-input');
      if (input && window.SpatialNav) {
        window.SpatialNav.setFocus(input);
      }
    }, 80);
  }

  closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';

    if (window.SpatialNav) {
      const openBtn = document.getElementById('btn-open-importer');
      if (openBtn) {
        window.SpatialNav.setFocus(openBtn);
      } else {
        window.SpatialNav.validateFocus();
      }
    }
  }

  async executePlaylistImport() {
    const input = document.getElementById('import-url-input');
    const val = input ? input.value.trim() : '';
    if (!val) {
      this.showToast('⚠️ Please enter a playlist URL or song titles first');
      return;
    }

    const progressBox = document.getElementById('import-progress-box');
    const progressBar = document.getElementById('import-progress-bar');
    const statusText = document.getElementById('import-status-text');
    const progressCount = document.getElementById('import-progress-count');

    if (progressBox) progressBox.style.display = 'block';

    const onProgress = (percent, msg) => {
      if (progressBar) progressBar.style.width = percent + '%';
      if (progressCount) progressCount.textContent = Math.round(percent) + '%';
      if (statusText) statusText.textContent = msg;
    };

    try {
      if (!window.PlaylistImporter) {
        throw new Error('PlaylistImporter not loaded');
      }

      onProgress(10, 'Analyzing playlist format...');
      const playlist = await window.PlaylistImporter.importPlaylist(val, onProgress);

      if (playlist && playlist.tracks && playlist.tracks.length > 0) {
        if (window.Library && window.Library.savePlaylist) {
          window.Library.savePlaylist(playlist);
        }

        onProgress(100, `Done! Imported ${playlist.tracks.length} tracks.`);
        this.showToast(`🎉 Imported "${playlist.title}" with ${playlist.tracks.length} songs!`);
        
        setTimeout(() => {
          this.closeImportModal();
          if (progressBox) progressBox.style.display = 'none';
          if (input) input.value = '';
          this.renderLibrary();
        }, 1200);
      } else {
        throw new Error('No playable tracks could be resolved');
      }
    } catch (err) {
      console.error('Playlist import failed:', err);
      if (statusText) statusText.textContent = 'Import failed: ' + (err.message || 'Unknown error');
      this.showToast('❌ Import error: ' + (err.message || 'Check URL'));
      setTimeout(() => {
        if (progressBox) progressBox.style.display = 'none';
      }, 3000);
    }
  }

  ensureDynamicDOM() {
    // 1. Remove Top bar Import button if present (user explicitly requested it only in Library)
    const oldHeaderImport = document.getElementById('btn-header-import');
    if (oldHeaderImport) {
      oldHeaderImport.remove();
    }

    // 2. On-screen Karaoke Mic Card in player hero column
    if (!document.getElementById('karaoke-mic-onscreen-card')) {
      const heroCol = document.querySelector('.player-hero-column');
      if (heroCol) {
        const card = document.createElement('div');
        card.id = 'karaoke-mic-onscreen-card';
        card.className = 'karaoke-mic-onscreen-card focusable';
        card.tabIndex = 0;
        card.title = 'Wireless Mic Options';
        card.setAttribute('data-focus-name', 'Wireless Mic Options');
        card.innerHTML = `
          <div class="karaoke-mic-card-header">
            <span class="karaoke-mic-badge-icon">🎙️</span>
            <div class="karaoke-mic-text-group">
              <div class="karaoke-mic-headline">Wireless Karaoke Mic</div>
              <div class="karaoke-mic-tagline">Scan with phone to sing live</div>
            </div>
          </div>
          <div id="karaoke-onscreen-qr" class="karaoke-onscreen-qr"></div>
          <div class="karaoke-mic-card-footer">
            <div id="karaoke-onscreen-status-pill" class="karaoke-mic-status-pill disconnected">
              <span class="status-indicator-dot"></span>
              <span id="karaoke-onscreen-status-text">Waiting for phone...</span>
            </div>
            <div class="karaoke-cason-hint">💡 Cason Bluetooth Mic: Pair in TV Sound Settings</div>
          </div>
        `;
        card.addEventListener('click', () => this.openMicModal());
        const artFrame = heroCol.querySelector('.player-art-frame');
        if (artFrame && artFrame.nextSibling) {
          heroCol.insertBefore(card, artFrame.nextSibling);
        } else {
          heroCol.appendChild(card);
        }
      }
    }

    // 3. Lyrics Sync Calibration HUD in player side column
    if (!document.getElementById('lyrics-sync-hud')) {
      const sideCol = document.querySelector('.player-side-column');
      if (sideCol) {
        const hud = document.createElement('div');
        hud.id = 'lyrics-sync-hud';
        hud.className = 'lyrics-sync-hud';
        hud.innerHTML = `
          <button id="btn-sync-earlier" class="sync-nudge-btn focusable" tabindex="0" title="Lyrics Earlier (-0.5s)" data-focus-name="Lyrics Earlier">⏪ -0.5s</button>
          <span id="sync-offset-display" class="sync-offset-pill">Sync: 0.0s</span>
          <button id="btn-sync-later" class="sync-nudge-btn focusable" tabindex="0" title="Lyrics Later (+0.5s)" data-focus-name="Lyrics Later">+0.5s ⏩</button>
          <button id="btn-sync-reset" class="sync-reset-btn focusable" tabindex="0" title="Reset (0.0s)" data-focus-name="Reset Sync">Reset</button>
        `;
        sideCol.insertBefore(hud, sideCol.firstChild);
        this.setupLyricsSyncControls();
      }
    }

    // 4. Ensure Import Modal exists in DOM
    if (!document.getElementById('import-modal')) {
      const modal = document.createElement('div');
      modal.id = 'import-modal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="party-modal-card" style="max-width: 820px;">
          <div class="party-modal-header">
            <div class="party-brand-lockup">
              <div class="party-logo-badge" style="background: linear-gradient(135deg, #1db954, #1ed760);">📲</div>
              <div>
                <h2 class="party-title">Import External Playlists</h2>
                <p class="party-subtitle">Spotify · JioSaavn · Apple Music · YouTube Music · Text List</p>
              </div>
            </div>
            <button id="btn-close-import" class="party-close-btn focusable" tabindex="0" title="Close">✕</button>
          </div>

          <div class="party-modal-body" style="grid-template-columns: 260px 1fr; gap: 32px;">
            <div class="party-qr-container">
              <div id="import-qr-canvas" class="party-qr-box"></div>
              <p class="party-qr-hint">Scan on phone to easily paste links from Spotify or Apple Music</p>
            </div>

            <div class="party-info-pane">
              <p style="font-size: 15px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5;">
                Paste a public playlist URL or track list. Songs will be resolved into full HD TV streams and saved to your TV Library:
              </p>

              <div style="display: flex; flex-direction: column; gap: 14px;">
                <input type="text" id="import-url-input" class="tv-text-input focusable" tabindex="0" placeholder="Paste Spotify / JioSaavn / YouTube link or Artist - Song list..." spellcheck="false" autocomplete="off" />
                
                <div style="display: flex; gap: 12px;">
                  <button id="btn-execute-import" class="pill-opt-btn focusable" tabindex="0" style="flex: 1; padding: 14px 20px; font-weight: 700; background: #1db954; color: #fff;">
                    ⚡ Import Now
                  </button>
                  <button id="btn-import-sample" class="pill-opt-btn focusable" tabindex="0" style="padding: 14px 20px; font-weight: 600; background: rgba(255,255,255,0.08); color: #fff;">
                    Try Demo Bollywood Mix
                  </button>
                </div>

                <div id="import-progress-box" style="display: none; margin-top: 10px; padding: 14px; background: rgba(255,255,255,0.04); border-radius: 12px;">
                  <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                    <span id="import-status-text">Fetching tracks...</span>
                    <span id="import-progress-count">0%</span>
                  </div>
                  <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                    <div id="import-progress-bar" style="height: 100%; width: 0%; background: #1db954; transition: width 0.3s ease;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const closeBtn = modal.querySelector('#btn-close-import');
      if (closeBtn) closeBtn.addEventListener('click', () => this.closeImportModal());
      const execBtn = modal.querySelector('#btn-execute-import');
      if (execBtn) execBtn.addEventListener('click', () => this.executePlaylistImport());
      const sampleBtn = modal.querySelector('#btn-import-sample');
      if (sampleBtn) sampleBtn.addEventListener('click', () => {
        const inp = modal.querySelector('#import-url-input');
        if (inp) {
          inp.value = 'Arijit Singh - Kesariya\nDiljit Dosanjh - Lover\nBadshah - Jugnu\nShreya Ghoshal - Deewani Mastani\nAP Dhillon - With You';
          this.executePlaylistImport();
        }
      });
    }

    // 5. Ensure Mic Modal exists in DOM
    if (!document.getElementById('mic-modal')) {
      const modal = document.createElement('div');
      modal.id = 'mic-modal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="party-modal-card" style="max-width: 820px;">
          <div class="party-modal-header">
            <div class="party-brand-lockup">
              <div class="party-logo-badge" style="background: linear-gradient(135deg, #ff007a, #7928ca);">🎙️</div>
              <div>
                <h2 class="party-title">Wireless Karaoke Microphone</h2>
                <p class="party-subtitle">Turn your phone or Bluetooth mic into a live TV stage microphone</p>
              </div>
            </div>
            <button id="btn-close-mic" class="party-close-btn focusable" tabindex="0" title="Close">✕</button>
          </div>

          <div class="party-modal-body" style="grid-template-columns: 260px 1fr; gap: 32px;">
            <div class="party-qr-container">
              <div id="mic-qr-canvas" class="party-qr-box"></div>
              <p class="party-qr-hint">Scan with phone camera to sing live through TV speakers</p>
              <div id="mic-connection-status" class="mic-status-pill disconnected">
                <span class="status-indicator-dot"></span>
                <span id="mic-status-text">Waiting for phone...</span>
              </div>
            </div>

            <div class="party-info-pane">
              <div class="party-perk-row">
                <div class="perk-icon">📱</div>
                <div class="perk-desc">
                  <strong>Phone as Studio Mic:</strong> Real-time voice stream directly mixed into TV audio with ultra-low latency.
                </div>
              </div>
              <div class="party-perk-row">
                <div class="perk-icon">✨</div>
                <div class="perk-desc">
                  <strong>Studio Echo & Slapback:</strong> Built-in 160ms concert hall echo creates a live stage singing feel.
                </div>
              </div>
              <div class="party-perk-row">
                <div class="perk-icon">🎤</div>
                <div class="perk-desc">
                  <strong>Cason / Bluetooth Mics:</strong> Pair your Cason wireless mic via TV <em>Settings → Sound → Sound Output → Bluetooth Speaker List</em>, or use it standalone with TV backing tracks!
                </div>
              </div>

              <div style="margin-top: 24px; display: flex; gap: 14px; align-items: center;">
                <button id="btn-toggle-mic-test" class="pill-opt-btn focusable" tabindex="0" style="padding: 12px 24px; font-weight: 700; background: #252836; color: #fff;">
                  🔊 Test TV Mic Input
                </button>
                <button id="btn-mic-echo-toggle" class="pill-opt-btn focusable" tabindex="0" style="padding: 12px 24px; font-weight: 700; background: rgba(255,255,255,0.08); color: #fff;">
                  Echo: <span id="tv-mic-echo-status">ON (160ms)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const closeBtn = modal.querySelector('#btn-close-mic');
      if (closeBtn) closeBtn.addEventListener('click', () => this.closeMicModal());
    }

    // 6. Fallback bootloader for PlaylistImporter
    if (!window.PlaylistImporter) {
      try {
        const cached = localStorage.getItem('layatv_ota_file_js/providers/playlist-importer.js');
        const s = document.createElement('script');
        if (cached && cached.trim().length > 0) {
          s.textContent = cached;
        } else {
          s.src = 'js/providers/playlist-importer.js';
        }
        document.body.appendChild(s);
      } catch(e) {}
    }
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.style.display = 'block';

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2400);
  }
}

function bootLaya() {
  if (!window.UIController) {
    window.UIController = new UIViewController();
    console.log('[Laya] UIController successfully mounted and initialized');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootLaya);
} else {
  bootLaya();
}
