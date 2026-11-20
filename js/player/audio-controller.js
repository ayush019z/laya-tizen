/**
 * Laya TV - High Fidelity Audio Controller & Stream Engine
 */
class AudioController {
  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';
    this.isPlaying = false;
    this.currentTrack = null;
    this.currentLyrics = [];
    this.activeLyricIndex = -1;

    this.setupAudioListeners();
  }

  setupAudioListeners() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayStateUI();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayStateUI();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.onTimeUpdate();
    });

    this.audio.addEventListener('ended', () => {
      this.playNext();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('[AudioController] Stream error, attempting auto-recovery:', e);
      if (window.UIController) {
        window.UIController.showToast('Stream buffer reconnecting...');
      }
      setTimeout(() => this.playNext(), 1500);
    });
  }

  async playTrack(track, fromQueue = false) {
    if (!track) return;
    this.currentTrack = track;

    // 1. Dynamic Artwork Palette Extraction (Material 3 Themepack)
    if (window.PaletteExtractor) {
      window.PaletteExtractor.extractAndApply(track.artwork);
    }

    // 2. Attach Web Audio DSP Engine ONLY if user enabled Reverb or Karaoke
    // Otherwise keep native TV hardware audio decoding (0% CPU load)
    if (window.AudioDSP && (window.AudioDSP.reverbPreset !== 'off' || window.UIController?.isKaraokeActive)) {
      window.AudioDSP.attachAudioElement(this.audio);
    }

    // Update metadata immediately
    this.updateMetadataUI(track);

    try {
      const streamUrl = await window.MusicProvider.resolveTrackStream(track);
      this.audio.src = streamUrl;
      await this.audio.play();
      this.isPlaying = true;
    } catch (err) {
      console.warn('[AudioController] Play failed, retrying fallback:', err);
      this.audio.src = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
      try {
        await this.audio.play();
        this.isPlaying = true;
      } catch (e) {
        console.error('[AudioController] Playback error:', e);
      }
    }

    // 3. Load Apple-Style Word-Synced Lyrics via LRCLIB / Service
    this.loadLyrics(track);

    // Setup Media Session API for TV system HUD
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Laya',
        artwork: [
          { src: track.artwork, sizes: '512x512', type: 'image/jpeg' }
        ]
      });
      navigator.mediaSession.setActionHandler('play', () => this.togglePlayPause());
      navigator.mediaSession.setActionHandler('pause', () => this.togglePlayPause());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrevious());
    }

    if (window.Library) {
      window.Library.addHistory(track);
    }

    // Trigger Infinite Radio autoplay if playing standalone track
    if (window.Queue) {
      window.Queue.checkAndTriggerAutoplay();
    }
  }

  togglePlayPause() {
    if (!this.currentTrack) {
      const first = window.Queue.getCurrentTrack() || window.MusicProvider.curatedCatalogue[0];
      if (first) {
        window.Queue.setQueue(window.MusicProvider.curatedCatalogue, 0);
        this.playTrack(first);
      }
      return;
    }

    if (this.audio.paused) {
      this.audio.play();
    } else {
      this.audio.pause();
    }
  }

  playNext() {
    const nextTrack = window.Queue.advance();
    if (nextTrack) {
      this.playTrack(nextTrack, true);
    }
  }

  playPrevious() {
    if (this.audio.currentTime > 4) {
      this.audio.currentTime = 0;
      return;
    }
    const prevTrack = window.Queue.retreat();
    if (prevTrack) {
      this.playTrack(prevTrack, true);
    }
  }

  seek(seconds) {
    if (!isNaN(this.audio.duration)) {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration));
    }
  }

  seekRelative(delta) {
    if (!isNaN(this.audio.duration)) {
      this.seek(this.audio.currentTime + delta);
      if (window.UIController) {
        window.UIController.showToast(delta > 0 ? `+${delta}s Forward` : `${delta}s Rewind`);
      }
    }
  }

  async loadLyrics(track) {
    if (window.LyricsService) {
      this.currentLyrics = await window.LyricsService.fetchLyrics(track);
    } else {
      this.currentLyrics = await window.MusicProvider.getLyrics(track);
    }

    this.activeLyricIndex = -1;
    if (window.UIController) {
      window.UIController.renderLyrics(this.currentLyrics);
    }
  }

  onTimeUpdate() {
    const current = this.audio.currentTime || 0;
    const duration = this.audio.duration || 1;
    const progressPercent = Math.min(100, (current / duration) * 100);

    const miniBar = document.querySelector('.mini-progress-bar');
    if (miniBar) miniBar.style.width = `${progressPercent}%`;

    const scrubberFill = document.querySelector('.scrubber-fill');
    if (scrubberFill) scrubberFill.style.width = `${progressPercent}%`;

    const currentLabel = document.getElementById('time-current');
    if (currentLabel) currentLabel.textContent = this.formatTime(current);

    const durationLabel = document.getElementById('time-duration');
    if (durationLabel && !isNaN(this.audio.duration)) {
      durationLabel.textContent = this.formatTime(this.audio.duration);
    }

    // Word-Synced Syllable Highlighting
    if (window.UIController && this.currentLyrics && this.currentLyrics.length > 0) {
      window.UIController.updateWordLyrics(this.currentLyrics, current);
    }
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  updateMetadataUI(track) {
    if (!track) return;
    const artworkUrl = track.artwork || 'assets/icon.png';
    const titleText = track.title || 'Unknown Title';
    const artistText = track.artist || 'Unknown Artist';

    // 1. Update Mini-Player Capsule Dock
    const miniArt = document.querySelector('.mini-capsule-art img') || document.querySelector('.mini-artwork img');
    if (miniArt) miniArt.src = artworkUrl;
    const miniTitle = document.querySelector('.mini-capsule-title') || document.querySelector('.mini-title');
    if (miniTitle) miniTitle.textContent = titleText;
    const miniArtist = document.querySelector('.mini-capsule-artist') || document.querySelector('.mini-artist');
    if (miniArtist) miniArtist.textContent = artistText;

    // 2. Update Fullscreen Player View
    const fsArt = document.querySelector('.player-art-frame img');
    if (fsArt) fsArt.src = artworkUrl;
    const fsBackdrop = document.querySelector('.player-backdrop');
    if (fsBackdrop) fsBackdrop.style.backgroundImage = `url("${artworkUrl}")`;
    const fsTitle = document.querySelector('.player-title-text') || document.querySelector('.player-meta-title');
    if (fsTitle) fsTitle.textContent = titleText;
    const fsArtist = document.querySelector('.player-artist-text') || document.querySelector('.player-meta-artist');
    if (fsArtist) fsArtist.textContent = artistText;
  }

  updatePlayStateUI() {
    const playIcons = document.querySelectorAll('.play-icon-svg');
    const pauseIcons = document.querySelectorAll('.pause-icon-svg');

    if (this.isPlaying) {
      playIcons.forEach(el => el.style.display = 'none');
      pauseIcons.forEach(el => el.style.display = 'block');
    } else {
      playIcons.forEach(el => el.style.display = 'block');
      pauseIcons.forEach(el => el.style.display = 'none');
    }
  }
}

window.AudioPlayer = new AudioController();
