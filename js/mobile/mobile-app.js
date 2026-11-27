/**
 * Laya Mobile - Enhanced Touch-First Frosted Glass UI Application
 * Excludes TV-only features (Karaoke stage, Casio hardware mic, WebRTC Juke party, Spatial D-pad nav)
 * Leverages high mobile GPU power with dynamic ambient mesh gradients, fluid gestures, and instant streaming.
 */

class MobileApp {
  constructor() {
    this.currentTab = 'home';
    this.prevViewBeforePlaylist = 'search';
    this.searchDebounceTimer = null;
    this.isSeeking = false;
    this.isLyricsActive = false;
    this.isQueueActive = false;
  }

  init() {
    console.log('[Laya Mobile] Initializing Mobile Experience...');
    this.setupTabs();
    this.setupSearch();
    this.setupPlayerControls();
    this.setupTouchGestures();
    this.setupLibrary();
    this.setupImporterModal();
    this.renderHome();

    // Connect with AudioController & Queue
    this.connectAudioListeners();

    // Default: Check if track is already queued or playing
    this.updateMiniPlayerState();
  }

  vibrate(duration = 10) {
    if (navigator.vibrate) {
      try { navigator.vibrate(duration); } catch (e) {}
    }
  }

  showToast(message, duration = 2500) {
    const toast = document.getElementById('mobile-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, duration);
  }

  // =====================================================================
  // 1. NAVIGATION & TABS
  // =====================================================================
  setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab-item');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetView = tab.getAttribute('data-view');
        this.switchTab(targetView);
        this.vibrate(8);
      });
    });

    // Quick search pill on Home
    const homeSearchPill = document.getElementById('home-quick-search');
    if (homeSearchPill) {
      homeSearchPill.addEventListener('click', () => {
        this.switchTab('search');
        const input = document.getElementById('mobile-search-input');
        if (input) input.focus();
      });
    }

    // Genre chips on Search
    const chips = document.querySelectorAll('.genre-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query') || chip.textContent.trim();
        const input = document.getElementById('mobile-search-input');
        if (input) {
          input.value = query;
          this.executeSearch(query);
        }
      });
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update bottom nav active state
    document.querySelectorAll('.nav-tab-item').forEach(tab => {
      if (tab.getAttribute('data-view') === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update views
    document.querySelectorAll('.mobile-view').forEach(view => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) {
      activeView.classList.add('active');
    }

    // Trigger tab-specific refresh
    if (tabName === 'home') {
      this.renderHome();
    } else if (tabName === 'library') {
      this.renderLibrary();
    }
  }

  // =====================================================================
  // 2. SEARCH & VERIFIED ARTIST SPOTLIGHT
  // =====================================================================
  setupSearch() {
    const input = document.getElementById('mobile-search-input');
    const clearBtn = document.getElementById('btn-clear-search');

    if (!input) return;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';

      clearTimeout(this.searchDebounceTimer);
      if (q.length > 1) {
        this.searchDebounceTimer = setTimeout(() => {
          this.executeSearch(q);
        }, 320);
      } else if (q.length === 0) {
        this.clearSearchResults();
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        this.clearSearchResults();
        input.focus();
      });
    }
  }

  clearSearchResults() {
    const container = document.getElementById('search-results-list');
    if (container) container.innerHTML = '';
    const genres = document.getElementById('search-browse-section');
    if (genres) genres.style.display = 'block';
  }

  async executeSearch(query) {
    const container = document.getElementById('search-results-list');
    const genres = document.getElementById('search-browse-section');
    if (!container) return;

    if (genres) genres.style.display = 'none';
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 15px;">Searching for "${query}"...</div>`;

    try {
      const [results, artistMatch] = await Promise.all([
        window.MusicProvider.search(query),
        window.MusicProvider.searchArtist(query)
      ]);

      container.innerHTML = '';

      if ((!results || results.length === 0) && !artistMatch) {
        container.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-dim); font-size: 15px;">No songs found for "${query}". Try another title or artist.</div>`;
        return;
      }

      // 1. Render Verified Artist Spotlight Card if artist found
      if (artistMatch) {
        const artistCard = document.createElement('div');
        artistCard.className = 'artist-spotlight-card';
        const followersStr = artistMatch.follower_count ? `${parseInt(artistMatch.follower_count, 10).toLocaleString()} Monthly Listeners • ` : '';
        artistCard.innerHTML = `
          <div class="artist-spotlight-avatar-wrap">
            <img class="artist-spotlight-avatar" src="${artistMatch.artwork}" alt="${artistMatch.name}" loading="lazy"/>
            <div class="artist-verified-pill" title="Verified Artist">✓</div>
          </div>
          <div class="artist-spotlight-meta">
            <div class="artist-spotlight-label">VERIFIED ARTIST</div>
            <div class="artist-spotlight-name">${artistMatch.name}</div>
            <div class="artist-spotlight-sub">${followersStr}Official Discography</div>
            <button class="btn-open-discography-mobile">
              <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              <span>Open Total Musics</span>
            </button>
          </div>
        `;

        artistCard.addEventListener('click', () => {
          this.vibrate(15);
          this.openArtistDiscography(artistMatch.id, artistMatch.name, artistMatch.artwork);
        });

        container.appendChild(artistCard);
      }

      // 2. Render Track Results
      if (results && results.length > 0) {
        const header = document.createElement('div');
        header.style.cssText = 'font-size: 14px; font-weight: 800; color: var(--text-dim); text-transform: uppercase; margin: 16px 0 10px 4px; letter-spacing: 0.8px;';
        header.textContent = `Songs & Tracks (${results.length})`;
        container.appendChild(header);

        results.forEach(track => {
          const row = document.createElement('div');
          row.className = 'search-track-row';
          row.innerHTML = `
            <div class="search-track-art">
              <img src="${window.getHighQualityArtwork ? window.getHighQualityArtwork(track.artwork) : track.artwork}" alt="" loading="lazy"/>
            </div>
            <div class="search-track-info">
              <div class="search-track-title">${track.title}</div>
              <div class="search-track-sub">${track.artist} · ${track.album || ''}</div>
            </div>
            <div class="search-track-duration">${track.durationFormatted || '3:20'}</div>
          `;

          row.addEventListener('click', () => {
            this.vibrate(10);
            window.Queue.setQueue(results, results.indexOf(track));
            window.AudioPlayer.playTrack(track);
            this.openFullscreenPlayer();
          });

          container.appendChild(row);
        });
      }
    } catch (err) {
      console.error('[Search] Query error:', err);
      container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 14px;">Error searching tracks. Please try again.</div>`;
    }
  }

  // =====================================================================
  // 3. ARTIST TOTAL MUSICS (DISCOGRAPHY) VIEW
  // =====================================================================
  async openArtistDiscography(artistId, artistName, artistImage) {
    this.prevViewBeforePlaylist = this.currentTab;
    this.showToast(`Loading complete discography for ${artistName}...`);

    try {
      const discography = await window.MusicProvider.getArtistDiscography(artistId, artistName);
      if (!discography || !discography.tracks || discography.tracks.length === 0) {
        this.showToast(`No discography tracks found for ${artistName}`);
        return;
      }

      const playlistModel = {
        id: 'artist_' + artistId,
        isArtistDiscography: true,
        title: `${artistName} · Total Musics`,
        name: `${artistName} · Total Musics`,
        artist: artistName,
        artwork: discography.artist?.artwork || artistImage,
        tracks: discography.tracks
      };

      this.renderPlaylistView(playlistModel);
      this.switchTab('playlist');
      this.showToast(`Loaded ${discography.tracks.length} songs for ${artistName}`);
    } catch (e) {
      console.error('[Discography] Error:', e);
      this.showToast(`Failed to load discography`);
    }
  }

  renderPlaylistView(pl) {
    const container = document.getElementById('view-playlist');
    if (!container) return;

    const tracks = pl.tracks || [];
    const isDiscography = !!pl.isArtistDiscography;
    const title = pl.title || pl.name || 'Untitled';
    const rawArt = pl.artwork || (tracks[0] ? tracks[0].artwork : 'assets/icon.png');
    const artwork = window.getHighQualityArtwork ? window.getHighQualityArtwork(rawArt) : rawArt;

    let totalSecs = 0;
    tracks.forEach(t => {
      if (t.durationFormatted) {
        const parts = t.durationFormatted.split(':');
        if (parts.length === 2) totalSecs += parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      } else {
        totalSecs += 210;
      }
    });
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const durationStr = hours > 0 ? `${hours} hr ${mins} min` : `${mins} min`;
    const backText = this.prevViewBeforePlaylist === 'search' ? '← Back to Search' : '← Back to Library';

    let html = `
      <div id="mobile-discography-header">
        <button id="btn-discography-back" class="btn-screen-back">
          <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          <span>${backText}</span>
        </button>

        <div class="discography-hero-card">
          <img class="discography-hero-avatar" src="${artwork}" alt="${title}"/>
          <div class="discography-hero-info">
            <div class="discography-badge">${isDiscography ? 'ARTIST • TOTAL MUSICS' : 'PLAYLIST'}</div>
            <h1 class="discography-hero-title">${title}</h1>
            <div class="discography-hero-meta">${tracks.length} songs • ${durationStr}</div>
          </div>
        </div>

        <div class="discography-actions-row">
          <button id="btn-discography-play-all" class="btn-action-play-all">
            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><path d="M8 5v14l11-7z"/></svg>
            <span>Play All</span>
          </button>
          <button id="btn-discography-shuffle" class="btn-action-shuffle">
            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
            <span>Shuffle</span>
          </button>
        </div>
      </div>

      <div class="discography-tracklist">
    `;

    tracks.forEach((t, idx) => {
      const num = (idx + 1 < 10 ? '0' : '') + (idx + 1);
      html += `
        <div class="search-track-row" data-track-index="${idx}">
          <div style="width: 24px; font-size: 13px; font-weight: 700; color: var(--text-dim); text-align: center;">${num}</div>
          <div class="search-track-art">
            <img src="${window.getHighQualityArtwork ? window.getHighQualityArtwork(t.artwork || 'assets/icon.png') : (t.artwork || 'assets/icon.png')}" alt="" loading="lazy"/>
          </div>
          <div class="search-track-info">
            <div class="search-track-title">${t.title}</div>
            <div class="search-track-sub">${t.artist} · ${t.album || 'Single'}</div>
          </div>
          <div class="search-track-duration">${t.durationFormatted || '3:30'}</div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

    // Attach listeners
    const backBtn = container.querySelector('#btn-discography-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.switchTab(this.prevViewBeforePlaylist || 'search');
        this.vibrate(8);
      });
    }

    const playAllBtn = container.querySelector('#btn-discography-play-all');
    if (playAllBtn) {
      playAllBtn.addEventListener('click', () => {
        if (tracks.length > 0) {
          this.vibrate(12);
          window.Queue.setQueue(tracks, 0);
          window.AudioPlayer.playTrack(tracks[0]);
          this.openFullscreenPlayer();
        }
      });
    }

    const shuffleBtn = container.querySelector('#btn-discography-shuffle');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => {
        if (tracks.length > 0) {
          this.vibrate(12);
          const shuffled = [...tracks].sort(() => Math.random() - 0.5);
          window.Queue.setQueue(shuffled, 0);
          window.AudioPlayer.playTrack(shuffled[0]);
          this.openFullscreenPlayer();
        }
      });
    }

    container.querySelectorAll('.search-track-row').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.getAttribute('data-track-index'), 10);
        if (!isNaN(idx) && tracks[idx]) {
          this.vibrate(10);
          window.Queue.setQueue(tracks, idx);
          window.AudioPlayer.playTrack(tracks[idx]);
          this.openFullscreenPlayer();
        }
      });
    });
  }

  // =====================================================================
  // 4. HOME SCREEN
  // =====================================================================
  renderHome() {
    // Dynamic greeting based on current hour
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';

    const greetingEl = document.getElementById('home-greeting-text');
    if (greetingEl) greetingEl.textContent = greeting;

    // Render Quick Play Highlights from Favorites / History
    this.renderHomeQuickGrid();

    // Render Trending and Curated Shelves
    this.renderHomeShelves();
  }

  renderHomeQuickGrid() {
    const container = document.getElementById('home-quick-grid');
    if (!container) return;

    const favorites = window.Library ? window.Library.getFavorites() : [];
    const history = window.Library ? window.Library.history : [];
    const quickItems = [...favorites, ...history].slice(0, 6);

    if (quickItems.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'grid';
    container.innerHTML = '';

    quickItems.forEach(t => {
      const card = document.createElement('div');
      card.className = 'quick-play-card';
      card.innerHTML = `
        <div class="quick-play-art">
          <img src="${window.getHighQualityArtwork ? window.getHighQualityArtwork(t.artwork) : t.artwork}" alt="" loading="lazy"/>
        </div>
        <div class="quick-play-title">${t.title}</div>
      `;
      card.addEventListener('click', () => {
        this.vibrate(10);
        window.Queue.setQueue([t], 0);
        window.AudioPlayer.playTrack(t);
        this.openFullscreenPlayer();
      });
      container.appendChild(card);
    });
  }

  renderHomeShelves() {
    const container = document.getElementById('home-shelves-container');
    if (!container || container.children.length > 0) return; // avoid duplicate renders

    // Curated shelves
    const shelves = [
      {
        title: 'Trending Bollywood & Pop',
        tracks: [
          { title: 'Tum Hi Ho', artist: 'Arijit Singh', artwork: 'https://c.saavncdn.com/430/Aashiqui-2-Hindi-2013-500x500.jpg', album: 'Aashiqui 2' },
          { title: 'Chaleya', artist: 'Arijit Singh, Shilpa Rao', artwork: 'https://c.saavncdn.com/047/Jawan-Hindi-2023-20230921190854-500x500.jpg', album: 'Jawan' },
          { title: 'Apna Bana Le', artist: 'Arijit Singh, Sachin-Jigar', artwork: 'https://c.saavncdn.com/815/Bhediya-Hindi-2023-20230927155213-500x500.jpg', album: 'Bhediya' },
          { title: 'Kesariya', artist: 'Arijit Singh, Pritam', artwork: 'https://c.saavncdn.com/044/Brahmastra-Hindi-2022-20220914180135-500x500.jpg', album: 'Brahmastra' },
          { title: 'Heeriye', artist: 'Jasleen Royal, Arijit Singh', artwork: 'https://c.saavncdn.com/022/Heeriye-feat-Arijit-Singh-Hindi-2023-20230928050405-500x500.jpg', album: 'Heeriye' }
        ]
      },
      {
        title: 'Punjabi Blockbusters & Vibes',
        tracks: [
          { title: 'Lover', artist: 'Diljit Dosanjh', artwork: 'https://c.saavncdn.com/393/MoonChild-Era-Punjabi-2021-20210826180327-500x500.jpg', album: 'MoonChild Era' },
          { title: 'Softly', artist: 'Karan Aujla, Ikky', artwork: 'https://c.saavncdn.com/034/Making-Memories-Punjabi-2023-20230818053846-500x500.jpg', album: 'Making Memories' },
          { title: 'Born to Shine', artist: 'Diljit Dosanjh', artwork: 'https://c.saavncdn.com/557/G-O-A-T--Punjabi-2020-20200730040713-500x500.jpg', album: 'G.O.A.T.' },
          { title: 'White Brown Black', artist: 'Karan Aujla, Avvy Sra', artwork: 'https://c.saavncdn.com/974/White-Brown-Black-Punjabi-2022-20221209053846-500x500.jpg', album: 'White Brown Black' }
        ]
      },
      {
        title: 'Global Hits & Chillwave',
        tracks: [
          { title: 'Espresso', artist: 'Sabrina Carpenter', artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80', album: 'Short n\' Sweet' },
          { title: 'Starboy', artist: 'The Weeknd, Daft Punk', artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80', album: 'Starboy' },
          { title: 'Blinding Lights', artist: 'The Weeknd', artwork: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80', album: 'After Hours' }
        ]
      }
    ];

    shelves.forEach(shelf => {
      const section = document.createElement('div');
      section.className = 'home-shelf-section';
      section.innerHTML = `
        <div class="section-header">
          <div class="section-title">${shelf.title}</div>
        </div>
        <div class="horizontal-scroller"></div>
      `;

      const scroller = section.querySelector('.horizontal-scroller');
      shelf.tracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'song-card-portrait';
        card.innerHTML = `
          <div class="song-card-art">
            <img src="${track.artwork}" alt="${track.title}" loading="lazy"/>
            <div class="song-card-play-overlay">
              <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <div class="song-card-title">${track.title}</div>
          <div class="song-card-sub">${track.artist}</div>
        `;

        card.addEventListener('click', () => {
          this.vibrate(10);
          window.Queue.setQueue(shelf.tracks, shelf.tracks.indexOf(track));
          window.AudioPlayer.playTrack(track);
          this.openFullscreenPlayer();
        });

        scroller.appendChild(card);
      });

      container.appendChild(section);
    });
  }

  // =====================================================================
  // 5. LIBRARY SCREEN
  // =====================================================================
  renderLibrary() {
    const favorites = window.Library ? window.Library.getFavorites() : [];
    const countEl = document.getElementById('lib-liked-count');
    if (countEl) {
      countEl.textContent = `${favorites.length} songs`;
    }

    const likedCard = document.getElementById('lib-liked-card');
    if (likedCard) {
      likedCard.onclick = () => {
        if (favorites.length > 0) {
          this.vibrate(12);
          this.renderPlaylistView({
            id: 'favorites',
            title: 'Liked Songs',
            artwork: favorites[0]?.artwork,
            tracks: favorites
          });
          this.switchTab('playlist');
        } else {
          this.showToast('No liked songs yet. Tap ♥ on any playing song!');
        }
      };
    }

    // Render imported playlists
    const playlistsContainer = document.getElementById('lib-playlists-list');
    if (playlistsContainer && window.Library) {
      const playlists = window.Library.getPlaylists ? window.Library.getPlaylists() : [];
      playlistsContainer.innerHTML = '';

      if (playlists.length === 0) {
        playlistsContainer.innerHTML = `<div style="font-size: 13px; color: var(--text-dim); padding: 8px 0;">No imported playlists yet.</div>`;
      } else {
        playlists.forEach(pl => {
          const row = document.createElement('div');
          row.className = 'search-track-row';
          row.innerHTML = `
            <div class="search-track-art">
              <img src="${window.getHighQualityArtwork ? window.getHighQualityArtwork(pl.artwork || pl.tracks?.[0]?.artwork) : 'assets/icon.png'}" alt=""/>
            </div>
            <div class="search-track-info">
              <div class="search-track-title">${pl.title}</div>
              <div class="search-track-sub">${pl.tracks?.length || 0} songs · Imported Playlist</div>
            </div>
          `;
          row.addEventListener('click', () => {
            this.vibrate(10);
            this.renderPlaylistView(pl);
            this.switchTab('playlist');
          });
          playlistsContainer.appendChild(row);
        });
      }
    }
  }

  // =====================================================================
  // 6. MINI PLAYER & FULLSCREEN PLAYER
  // =====================================================================
  setupPlayerControls() {
    // Mini player tap to expand
    const mini = document.getElementById('mobile-mini-player');
    if (mini) {
      mini.addEventListener('click', (e) => {
        if (!e.target.closest('.mini-btn')) {
          this.openFullscreenPlayer();
          this.vibrate(12);
        }
      });
    }

    // Mini Play/Pause
    const miniPlayBtn = document.getElementById('mini-btn-play');
    if (miniPlayBtn) {
      miniPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.vibrate(8);
        window.AudioPlayer.togglePlayPause();
      });
    }

    // Mini Next
    const miniNextBtn = document.getElementById('mini-btn-next');
    if (miniNextBtn) {
      miniNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.vibrate(8);
        window.AudioPlayer.playNext();
      });
    }

    // Fullscreen Player Collapse
    const collapseBtn = document.getElementById('btn-collapse-player');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        this.closeFullscreenPlayer();
        this.vibrate(8);
      });
    }

    // Fullscreen Play/Pause
    const playerPlayBtn = document.getElementById('player-btn-play');
    if (playerPlayBtn) {
      playerPlayBtn.addEventListener('click', () => {
        this.vibrate(12);
        window.AudioPlayer.togglePlayPause();
      });
    }

    // Prev / Next
    const prevBtn = document.getElementById('player-btn-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.vibrate(8);
        window.AudioPlayer.playPrevious();
      });
    }

    const nextBtn = document.getElementById('player-btn-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.vibrate(8);
        window.AudioPlayer.playNext();
      });
    }

    // Shuffle / Repeat
    const shuffleBtn = document.getElementById('player-btn-shuffle');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => {
        this.vibrate(8);
        window.Queue.isShuffled = !window.Queue.isShuffled;
        shuffleBtn.classList.toggle('active', window.Queue.isShuffled);
        this.showToast(window.Queue.isShuffled ? '🔀 Shuffle On' : 'Shuffle Off');
      });
    }

    const repeatBtn = document.getElementById('player-btn-repeat');
    if (repeatBtn) {
      repeatBtn.addEventListener('click', () => {
        this.vibrate(8);
        if (window.Queue.repeatMode === 'all') {
          window.Queue.repeatMode = 'one';
          repeatBtn.classList.add('active');
          this.showToast('🔂 Repeat Current Song');
        } else if (window.Queue.repeatMode === 'one') {
          window.Queue.repeatMode = 'none';
          repeatBtn.classList.remove('active');
          this.showToast('Repeat Off');
        } else {
          window.Queue.repeatMode = 'all';
          repeatBtn.classList.add('active');
          this.showToast('🔁 Repeat All');
        }
      });
    }

    // Favorite / Like Button
    const favBtn = document.getElementById('player-btn-fav');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        this.vibrate(14);
        const current = window.AudioPlayer.currentTrack;
        if (current && window.Library) {
          const isLiked = window.Library.toggleFavorite(current);
          favBtn.classList.toggle('active', isLiked);
          favBtn.textContent = isLiked ? '❤️' : '🤍';
        }
      });
    }

    // Lyrics Toggle
    const lyricsToggle = document.getElementById('btn-toggle-lyrics');
    if (lyricsToggle) {
      lyricsToggle.addEventListener('click', () => {
        this.vibrate(10);
        this.isLyricsActive = !this.isLyricsActive;
        lyricsToggle.classList.toggle('active', this.isLyricsActive);
        const panel = document.getElementById('mobile-lyrics-panel');
        if (panel) panel.classList.toggle('active', this.isLyricsActive);
      });
    }

    // Queue Toggle
    const queueToggle = document.getElementById('btn-toggle-queue');
    if (queueToggle) {
      queueToggle.addEventListener('click', () => {
        this.vibrate(10);
        this.renderQueueModal();
      });
    }

    // Scrubber Touch / Click
    const scrubber = document.getElementById('player-scrubber');
    if (scrubber) {
      const seekFromCoord = (clientX) => {
        const rect = scrubber.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const duration = window.AudioPlayer.audio.duration;
        if (!isNaN(duration) && duration > 0) {
          const targetTime = ratio * duration;
          window.AudioPlayer.seek(targetTime);
          this.updateScrubberUI(targetTime, duration);
        }
      };

      scrubber.addEventListener('click', (e) => {
        seekFromCoord(e.clientX);
      });

      scrubber.addEventListener('touchstart', (e) => {
        this.isSeeking = true;
        if (e.touches[0]) seekFromCoord(e.touches[0].clientX);
      }, { passive: true });

      scrubber.addEventListener('touchmove', (e) => {
        if (this.isSeeking && e.touches[0]) {
          seekFromCoord(e.touches[0].clientX);
        }
      }, { passive: true });

      scrubber.addEventListener('touchend', () => {
        this.isSeeking = false;
      });
    }
  }

  setupTouchGestures() {
    // Swipe down to collapse Fullscreen Player
    const playerSheet = document.getElementById('mobile-fullscreen-player');
    if (!playerSheet) return;

    let startY = 0;
    let currentY = 0;

    playerSheet.addEventListener('touchstart', (e) => {
      // Don't drag if scrolling inside lyrics or queue
      if (e.target.closest('#mobile-lyrics-panel') && this.isLyricsActive) return;
      startY = e.touches[0].clientY;
      currentY = startY;
    }, { passive: true });

    playerSheet.addEventListener('touchmove', (e) => {
      if (startY === 0) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      if (deltaY > 0) {
        playerSheet.style.transform = `translateY(${deltaY}px)`;
      }
    }, { passive: true });

    playerSheet.addEventListener('touchend', () => {
      const deltaY = currentY - startY;
      playerSheet.style.transform = '';
      if (deltaY > 120) {
        this.closeFullscreenPlayer();
        this.vibrate(8);
      }
      startY = 0;
      currentY = 0;
    });
  }

  openFullscreenPlayer() {
    const sheet = document.getElementById('mobile-fullscreen-player');
    if (sheet) sheet.classList.add('active');
  }

  closeFullscreenPlayer() {
    const sheet = document.getElementById('mobile-fullscreen-player');
    if (sheet) sheet.classList.remove('active');
  }

  connectAudioListeners() {
    if (!window.AudioPlayer) return;

    // Time update listener
    window.AudioPlayer.audio.addEventListener('timeupdate', () => {
      if (!this.isSeeking) {
        const cur = window.AudioPlayer.audio.currentTime || 0;
        const dur = window.AudioPlayer.audio.duration || 1;
        this.updateScrubberUI(cur, dur);
        this.updateLyricsHighlight(cur);
      }
    });

    // Play / Pause event listeners
    window.AudioPlayer.audio.addEventListener('play', () => {
      this.updatePlayPauseIcons(true);
    });

    window.AudioPlayer.audio.addEventListener('pause', () => {
      this.updatePlayPauseIcons(false);
    });

    // Track metadata update hook
    const origUpdateMeta = window.AudioPlayer.updateMetadataUI.bind(window.AudioPlayer);
    window.AudioPlayer.updateMetadataUI = (track) => {
      origUpdateMeta(track);
      this.syncMetadataToMobile(track);
    };
  }

  updateScrubberUI(currentTime, duration) {
    const ratio = Math.max(0, Math.min(100, (currentTime / (duration || 1)) * 100));
    
    // Mini player progress
    const miniProgress = document.getElementById('mini-progress-fill');
    if (miniProgress) miniProgress.style.width = `${ratio}%`;

    // Fullscreen player fill
    const fill = document.getElementById('player-scrubber-fill');
    if (fill) fill.style.width = `${ratio}%`;

    // Current time & Remaining time labels
    const curLabel = document.getElementById('player-time-cur');
    const remLabel = document.getElementById('player-time-rem');

    const formatTime = (secs) => {
      if (isNaN(secs)) return '0:00';
      const m = Math.floor(secs / 60);
      const s = String(Math.floor(secs % 60)).padStart(2, '0');
      return `${m}:${s}`;
    };

    if (curLabel) curLabel.textContent = formatTime(currentTime);
    if (remLabel) remLabel.textContent = `-${formatTime(Math.max(0, duration - currentTime))}`;
  }

  updatePlayPauseIcons(isPlaying) {
    const playSvg = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    const pauseSvg = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

    const miniBtn = document.getElementById('mini-btn-play');
    if (miniBtn) miniBtn.innerHTML = isPlaying ? pauseSvg : playSvg;

    const fullBtn = document.getElementById('player-btn-play');
    if (fullBtn) fullBtn.innerHTML = isPlaying ? pauseSvg : playSvg;

    const artCard = document.getElementById('player-artwork-card');
    if (artCard) artCard.classList.toggle('paused', !isPlaying);
  }

  syncMetadataToMobile(track) {
    if (!track) return;

    const highResArt = window.getHighQualityArtwork ? window.getHighQualityArtwork(track.artwork) : track.artwork;

    // Mini Player
    const mini = document.getElementById('mobile-mini-player');
    if (mini) mini.classList.remove('hidden');

    const miniArt = document.getElementById('mini-art-img');
    if (miniArt) miniArt.src = highResArt;
    const miniTitle = document.getElementById('mini-title');
    if (miniTitle) miniTitle.textContent = track.title;
    const miniArtist = document.getElementById('mini-artist');
    if (miniArtist) miniArtist.textContent = track.artist;

    // Fullscreen Player
    const playerArt = document.getElementById('player-art-img');
    if (playerArt) playerArt.src = highResArt;
    const playerTitle = document.getElementById('player-title');
    if (playerTitle) playerTitle.textContent = track.title;
    const playerArtist = document.getElementById('player-artist');
    if (playerArtist) playerArtist.textContent = `${track.artist} · ${track.album || ''}`;

    // Liked state
    const favBtn = document.getElementById('player-btn-fav');
    if (favBtn && window.Library) {
      const isLiked = window.Library.isFavorite(track.id);
      favBtn.classList.toggle('active', isLiked);
      favBtn.textContent = isLiked ? '❤️' : '🤍';
    }

    // Load Synced Lyrics
    this.renderLyrics(track);
  }

  updateMiniPlayerState() {
    const cur = window.Queue ? window.Queue.getCurrentTrack() : null;
    if (cur) {
      this.syncMetadataToMobile(cur);
    }
  }

  // =====================================================================
  // 7. SYNCHRONIZED LYRICS (Tap to Seek, Auto-Scroll)
  // =====================================================================
  async renderLyrics(track) {
    const container = document.getElementById('mobile-lyrics-panel');
    if (!container) return;

    container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-dim); font-size: 16px;">Loading lyrics...</div>`;

    try {
      const lyrics = await window.MusicProvider.getLyrics(track);
      this.currentLyrics = lyrics || [];
      container.innerHTML = '';

      if (this.currentLyrics.length === 0) {
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-dim); font-size: 16px;">No lyrics available for this song.</div>`;
        return;
      }

      this.currentLyrics.forEach((line, idx) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'lyric-line-mobile';
        lineEl.setAttribute('data-time', line.time);
        lineEl.setAttribute('data-index', idx);
        lineEl.textContent = line.text;

        lineEl.addEventListener('click', () => {
          this.vibrate(10);
          window.AudioPlayer.seek(line.time);
        });

        container.appendChild(lineEl);
      });
    } catch (e) {
      container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-dim); font-size: 16px;">Instrumental / Ambient Audio</div>`;
    }
  }

  updateLyricsHighlight(currentTime) {
    if (!this.currentLyrics || this.currentLyrics.length === 0) return;

    let activeIdx = -1;
    for (let i = 0; i < this.currentLyrics.length; i++) {
      if (currentTime >= this.currentLyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== this.activeLyricIndex) {
      this.activeLyricIndex = activeIdx;
      const lines = document.querySelectorAll('.lyric-line-mobile');
      lines.forEach((el, idx) => {
        if (idx === activeIdx) {
          el.classList.add('active');
          if (this.isLyricsActive) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          el.classList.remove('active');
        }
      });
    }
  }

  // =====================================================================
  // 8. UP NEXT QUEUE MODAL
  // =====================================================================
  renderQueueModal() {
    const modal = document.getElementById('mobile-queue-modal');
    if (!modal) return;
    modal.classList.add('active');

    const list = document.getElementById('queue-tracks-list');
    if (!list) return;

    const tracks = window.Queue ? window.Queue.tracks : [];
    const curIdx = window.Queue ? window.Queue.currentIndex : 0;
    list.innerHTML = '';

    if (tracks.length === 0) {
      list.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-dim);">Queue is empty.</div>`;
      return;
    }

    tracks.forEach((t, idx) => {
      const row = document.createElement('div');
      row.className = 'search-track-row';
      if (idx === curIdx) {
        row.style.background = 'rgba(168, 85, 247, 0.25)';
        row.style.borderColor = 'rgba(168, 85, 247, 0.6)';
      }
      row.innerHTML = `
        <div style="width: 24px; font-size: 12px; font-weight: 800; color: ${idx === curIdx ? 'var(--dynamic-accent)' : 'var(--text-dim)'};">${idx === curIdx ? '▶' : (idx + 1)}</div>
        <div class="search-track-art">
          <img src="${window.getHighQualityArtwork ? window.getHighQualityArtwork(t.artwork) : t.artwork}" alt=""/>
        </div>
        <div class="search-track-info">
          <div class="search-track-title">${t.title}</div>
          <div class="search-track-sub">${t.artist}</div>
        </div>
      `;
      row.addEventListener('click', () => {
        this.vibrate(10);
        window.Queue.currentIndex = idx;
        window.AudioPlayer.playTrack(tracks[idx]);
        modal.classList.remove('active');
      });
      list.appendChild(row);
    });

    const closeBtn = document.getElementById('btn-close-queue-modal');
    if (closeBtn) {
      closeBtn.onclick = () => modal.classList.remove('active');
    }
  }

  // =====================================================================
  // 9. UNIVERSAL PLAYLIST IMPORTER (Spotify, Apple Music, JioSaavn)
  // =====================================================================
  setupImporterModal() {
    const openBtn = document.getElementById('lib-import-card');
    const modal = document.getElementById('modal-importer');
    const closeBtn = document.getElementById('btn-close-importer');
    const submitBtn = document.getElementById('btn-submit-import');
    const input = document.getElementById('import-url-input');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        this.vibrate(10);
        modal.classList.add('active');
        if (input) input.focus();
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }

    if (submitBtn && input && window.PlaylistImporter) {
      submitBtn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) {
          this.showToast('Please paste a link or song list');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Importing Playlist...';
        this.showToast('Fetching songs & matching streams...');

        try {
          const playlist = await window.PlaylistImporter.importPlaylist(text);
          if (playlist && window.Library) {
            window.Library.savePlaylist(playlist);
            this.showToast(`Imported "${playlist.title}" (${playlist.tracks.length} tracks)!`);
            input.value = '';
            modal.classList.remove('active');
            this.renderLibrary();
          }
        } catch (err) {
          console.error('[Importer] Failed:', err);
          this.showToast(`Import error: ${err.message || 'Check link'}`);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Import Playlist';
        }
      });
    }
  }
}

// Instantiate Mobile Controller
window.MobileController = new MobileApp();
document.addEventListener('DOMContentLoaded', () => {
  window.MobileController.init();
});
