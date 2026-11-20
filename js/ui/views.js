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

    let html = `
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

    // Curated Playlists section
    html += `
      <div class="shelf">
        <div class="shelf-title">Your Playlists</div>
        <div class="shelf-track-container">
          <div class="media-card focusable" tabindex="0" data-playlist="chill">
            <div class="media-card-artwork"><img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80"/></div>
            <div class="media-card-title">Chill Soundscapes</div>
            <div class="media-card-author">5 Tracks • Ambient</div>
          </div>
          <div class="media-card-focusable media-card focusable" tabindex="0" data-playlist="trending">
            <div class="media-card-artwork"><img src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80"/></div>
            <div class="media-card-title">Short n' Sweet Hits</div>
            <div class="media-card-author">Sabrina & Friends</div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

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

    container.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('click', () => {
        const tracks = window.MusicProvider.curatedCatalogue;
        window.Queue.setQueue(tracks, 0);
        window.AudioPlayer.playTrack(tracks[0]);
        this.openFullscreenPlayer();
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

  // --- 6. Apple-Style Word-Synced Lyrics Renderer (am-lyrics) ---
  processLyricsWithInstrumentals(rawLyrics) {
    if (!rawLyrics || rawLyrics.length === 0) return [];
    const processed = [];

    // 1. Intro Instrumental: if first line starts after 4.0 seconds
    if (rawLyrics[0].time > 4.0) {
      processed.push({
        time: 0,
        isInstrumental: true,
        text: '🎶 🎶 🎶'
      });
    }

    for (let i = 0; i < rawLyrics.length; i++) {
      processed.push(rawLyrics[i]);

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
    const container = document.getElementById('lyrics-container');
    if (!container) return;

    if (!lyrics || lyrics.length === 0) {
      container.innerHTML = '<div style="color: var(--text-dim); font-size: 26px; padding: 40px 0;">Instrumental track / No lyrics available.</div>';
      return;
    }

    // Process lyrics to insert Apple Music style instrumental interludes
    const processedLyrics = this.processLyricsWithInstrumentals(lyrics);
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
        lineElem.className = 'lrc-line focusable';
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
          lineElem.textContent = line.text;
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

    // Fast-find active line index
    let activeLineIdx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) {
        activeLineIdx = i;
      } else {
        break;
      }
    }

    // Only touch the DOM when the active line actually changes (prevents massive 60fps DOM thrashing)
    if (this.activeLyricIndex === activeLineIdx) {
      return;
    }

    const prevIdx = this.activeLyricIndex;
    this.activeLyricIndex = activeLineIdx;

    const container = document.getElementById('lyrics-container');
    if (!container) return;

    if (prevIdx !== -1) {
      const prevLine = container.querySelector(`.lrc-line[data-line="${prevIdx}"]`);
      if (prevLine) prevLine.classList.remove('active');
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

        // 60fps GPU Hardware-Accelerated Smooth Scroll
        const scrollTrack = document.getElementById('lyrics-scroll-track');
        if (scrollTrack) {
          const targetY = -Math.max(0, currLine.offsetTop - 140);
          scrollTrack.style.transform = `translate3d(0, ${targetY}px, 0)`;
        }
      }
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
    const tag = document.getElementById('tv-room-code-tag');
    if (tag) tag.textContent = `ROOM: ${this.roomCode}`;

    const urlText = document.getElementById('party-url-text');
    const partyUrl = `http://layatv.local/party?room=${this.roomCode}`;
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
      this.showToast('🎤 Vocals Mode Active: Vocals Reduced & Full-Screen Lyrics!');
      
      const exitBtn = document.getElementById('btn-exit-karaoke');
      if (exitBtn && window.SpatialNav) {
        window.SpatialNav.setFocus(exitBtn);
      }
    } else {
      fsPlayer.classList.remove('karaoke-stage-active');
      this.showToast('Vocals Mode Turned Off');
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
