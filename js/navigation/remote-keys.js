/**
 * Laya TV - Samsung Tizen Hardware Remote Key Controller
 */
class RemoteKeyController {
  constructor() {
    this.tizenKeys = [
      'Enter',
      'Select',
      'ChannelUp',
      'ChannelDown',
      'MediaPlay',
      'MediaPause',
      'MediaPlayPause',
      'MediaStop',
      'MediaFastForward',
      'MediaRewind',
      'MediaTrackNext',
      'MediaTrackPrevious',
      'ColorF0Red',
      'ColorF1Green',
      'ColorF2Yellow',
      'ColorF3Blue',
      'ColorFlick',
      'Search',
      'VoiceSearch',
      'Menu',
      'MediaSettings',
      'Info',
      'Guide',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ];
    this.registerTizenKeys();
    this.attachGlobalListeners();
  }

  registerTizenKeys() {
    try {
      if (window.tizen && window.tizen.tvinputdevice) {
        // 1. Explicitly unregister volume keys to preserve Samsung TV native hardware volume HUD & amplifier control
        ['VolumeUp', 'VolumeDown', 'VolumeMute'].forEach(volKey => {
          try {
            window.tizen.tvinputdevice.unregisterKey(volKey);
            console.log(`[RemoteKey] Native volume preserved (unregistered ${volKey})`);
          } catch (e) {}
        });

        // 2. Register predefined essential media & control keys
        this.tizenKeys.forEach(keyName => {
          try {
            window.tizen.tvinputdevice.registerKey(keyName);
            console.log(`[RemoteKey] Registered key: ${keyName}`);
          } catch (err) {}
        });

        // 3. Dynamically register all other supported keys exposed by this Samsung TV model (EXCLUDING Volume & Mute)
        try {
          const supported = window.tizen.tvinputdevice.getSupportedKeys();
          if (Array.isArray(supported)) {
            supported.forEach(k => {
              const kName = (typeof k === 'object' && k.name) ? k.name : k;
              if (typeof kName === 'string' && /volume|mute/i.test(kName)) {
                return; // NEVER intercept TV hardware volume keys
              }
              try {
                window.tizen.tvinputdevice.registerKey(kName);
              } catch(e) {}
            });
            console.log(`[RemoteKey] Registered TV keys with hardware volume pass-through enabled`);
          }
        } catch(e) {}
      }
    } catch (e) {
      console.log('[RemoteKey] Tizen TV input device API not available (browser mode)');
    }
  }

  attachGlobalListeners() {
    window.addEventListener('keydown', (e) => this.handleHardwareKey(e));
  }

  handleHardwareKey(e) {
    const key = e.key;
    const keyCode = e.keyCode;

    // Screensaver Wakeup: Any keypress wakes cinema screensaver
    if (window.UIController && window.UIController.isScreensaverActive) {
      e.preventDefault();
      window.UIController.exitScreensaver();
      return;
    }

    // Handle Samsung Back / Return key (KeyCode 10009) or Escape (27)
    if (keyCode === 10009 || keyCode === 27) {
      e.preventDefault();
      this.handleBackAction();
      return;
    }

    // Voice / Mic button on modern Samsung SolarCell & Minimalist remotes
    if (keyCode === 10148 || keyCode === 65385 || key === 'Search' || key === 'VoiceSearch' || key === 'Speech') {
      e.preventDefault();
      if (window.UIController) {
        window.UIController.startVoiceSearch();
      }
      return;
    }

    // 1. Samsung Play / Pause Button [ ⏯ ]
    if (
      keyCode === 415 || // MediaPlay
      keyCode === 19 ||  // Pause
      keyCode === 10252 || // MediaPlayPause
      keyCode === 179 || // W3C VK_PLAY_PAUSE
      key === 'MediaPlayPause' ||
      key === 'PlayPause' ||
      key === 'Play' ||
      key === 'Pause'
    ) {
      if (window.AudioPlayer) {
        e.preventDefault();
        window.AudioPlayer.togglePlayPause();
        if (window.UIController) {
          setTimeout(() => {
            const isPlaying = window.AudioPlayer.isPlaying;
            window.UIController.showToast(isPlaying ? '▶️ Playing' : '⏸️ Paused');
          }, 60);
        }
      }
      return;
    }

    // 2. Samsung Channel Rocker UP [ ∧ ] (Next Track)
    if (
      keyCode === 427 || // Tizen ChannelUp
      keyCode === 10233 || // MediaTrackNext
      key === 'ChannelUp' ||
      key === 'MediaTrackNext'
    ) {
      if (window.AudioPlayer) {
        e.preventDefault();
        window.AudioPlayer.playNext();
        if (window.UIController) {
          window.UIController.showToast('⏭️ Skipping to Next Track');
        }
      }
      return;
    }

    // 3. Samsung Channel Rocker DOWN [ ∨ ] (Previous Track)
    if (
      keyCode === 428 || // Tizen ChannelDown
      keyCode === 10232 || // MediaTrackPrevious
      key === 'ChannelDown' ||
      key === 'MediaTrackPrevious'
    ) {
      if (window.AudioPlayer) {
        e.preventDefault();
        window.AudioPlayer.playPrevious();
        if (window.UIController) {
          window.UIController.showToast('⏮️ Skipping to Previous Track');
        }
      }
      return;
    }

    // 4. Media Fast Forward & Rewind
    if (keyCode === 417 || key === 'MediaFastForward') {
      if (window.AudioPlayer) {
        e.preventDefault();
        window.AudioPlayer.seekRelative(10);
        if (window.UIController) window.UIController.showToast('⏩ Fast Forward +10s');
      }
      return;
    }

    if (keyCode === 412 || key === 'MediaRewind') {
      if (window.AudioPlayer) {
        e.preventDefault();
        window.AudioPlayer.seekRelative(-10);
        if (window.UIController) window.UIController.showToast('⏪ Rewind -10s');
      }
      return;
    }

    // 5. Samsung 4-Color Keys [ 🔴🟢🟡🔵 ]
    // Red (403): Like / Favorite
    if (keyCode === 403 || key === 'ColorF0Red') {
      e.preventDefault();
      const favBtn = document.getElementById('btn-fav-track');
      if (favBtn) favBtn.click();
      return;
    }

    // Green (404): Vocals Mode / Karaoke
    if (keyCode === 404 || key === 'ColorF1Green') {
      e.preventDefault();
      if (window.UIController) window.UIController.toggleKaraokeStage();
      return;
    }

    // Yellow (405): Spectrum Visualizer
    if (keyCode === 405 || key === 'ColorF2Yellow') {
      e.preventDefault();
      if (window.UIController) window.UIController.toggleVisualizer();
      return;
    }

    // Blue (406): Party Jukebox QR Code
    if (keyCode === 406 || key === 'ColorF3Blue') {
      e.preventDefault();
      if (window.UIController) window.UIController.togglePartyModal();
      return;
    }

    // 4-Dots Color Button on Samsung OneRemote (KeyCode 10071)
    if (keyCode === 10071 || key === 'ColorFlick') {
      e.preventDefault();
      if (window.UIController) {
        window.UIController.toggleKaraokeStage();
      }
      return;
    }

    // 6. Menu / Settings / 123 Button [ ☰ / ⚙️ / 123 ] (10133, 10182, 18)
    if (keyCode === 10133 || keyCode === 10182 || keyCode === 18 || key === 'Menu' || key === 'MediaSettings' || key === 'Settings') {
      e.preventDefault();
      if (window.UIController) {
        const fsPlayer = document.getElementById('fullscreen-player');
        if (fsPlayer && fsPlayer.classList.contains('active')) {
          const settingsBtn = document.getElementById('btn-player-settings');
          if (settingsBtn) settingsBtn.click();
        } else {
          window.UIController.switchView('settings');
        }
      }
      return;
    }
  }

  handleBackAction() {
    // 0. If Wireless Mic Modal is open, close it
    const micModal = document.getElementById('mic-modal');
    if (micModal && (micModal.classList.contains('active') || micModal.style.display === 'flex')) {
      if (window.UIController) {
        window.UIController.closeMicModal();
      } else {
        micModal.classList.remove('active');
        micModal.style.display = 'none';
      }
      return;
    }

    // 0.1. If Playlist Importer Modal is open, close it
    const importModal = document.getElementById('import-modal');
    if (importModal && (importModal.classList.contains('active') || importModal.style.display === 'flex')) {
      if (window.UIController) {
        window.UIController.closeImportModal();
      } else {
        importModal.classList.remove('active');
        importModal.style.display = 'none';
      }
      return;
    }

    // 1. If Party Modal is open, close it
    const partyModal = document.getElementById('party-modal');
    if (partyModal && (partyModal.classList.contains('active') || partyModal.style.display === 'flex')) {
      if (window.UIController) {
        window.UIController.closePartyModal();
      } else {
        partyModal.classList.remove('active');
        partyModal.style.display = 'none';
      }
      return;
    }

    // 2. If Karaoke Stage is active in Fullscreen Player, exit karaoke mode first
    const fsPlayer = document.getElementById('fullscreen-player');
    if (fsPlayer && fsPlayer.classList.contains('karaoke-stage-active')) {
      if (window.UIController) {
        window.UIController.toggleKaraokeStage(false);
      }
      return;
    }

    // 4. If Fullscreen Player is open, close it and return to the underlying screen
    if (fsPlayer && fsPlayer.classList.contains('active')) {
      if (window.UIController) {
        window.UIController.closeFullscreenPlayer();
      }
      return;
    }

    // 2. If inside playlist view, return to Library
    if (window.UIController && window.UIController.currentView === 'playlist') {
      window.UIController.switchView('library');
      return;
    }

    // 3. If inside a sub-screen (Search, Library, Details) and not on Home, return to Home
    if (window.UIController && window.UIController.currentView !== 'home') {
      window.UIController.switchView('home');
      return;
    }

    // 3. If on Home, require double-press within 2.5 seconds to prevent accidental exit
    const now = Date.now();
    if (!this.lastBackPressTime || now - this.lastBackPressTime > 2500) {
      this.lastBackPressTime = now;
      if (window.UIController) {
        window.UIController.showToast('Press Back again to exit Laya');
      }
      return;
    }

    // Second press confirmed: cleanly exit
    if (window.tizen && window.tizen.application) {
      try {
        window.tizen.application.getCurrentApplication().exit();
      } catch (err) {
        console.error('Exit application failed:', err);
      }
    }
  }
}

window.RemoteController = new RemoteKeyController();
