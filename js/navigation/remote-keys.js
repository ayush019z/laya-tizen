/**
 * Laya TV - Samsung Tizen Hardware Remote Key Controller
 */
class RemoteKeyController {
  constructor() {
    this.tizenKeys = [
      'Enter',
      'Select',
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

    // Media Keys
    switch (keyCode) {
      case 415: // MediaPlay
      case 19:  // Pause
      case 413: // MediaStop
      case 10252: // MediaPlayPause
        if (window.AudioPlayer) {
          e.preventDefault();
          window.AudioPlayer.togglePlayPause();
        }
        break;
      case 417: // MediaFastForward
        if (window.AudioPlayer) {
          e.preventDefault();
          window.AudioPlayer.seekRelative(10);
        }
        break;
      case 412: // MediaRewind
        if (window.AudioPlayer) {
          e.preventDefault();
          window.AudioPlayer.seekRelative(-10);
        }
        break;
      case 10232: // MediaTrackPrevious
        if (window.AudioPlayer) {
          e.preventDefault();
          window.AudioPlayer.playPrevious();
        }
        break;
      case 10233: // MediaTrackNext
        if (window.AudioPlayer) {
          e.preventDefault();
          window.AudioPlayer.playNext();
        }
        break;
      default:
        break;
    }
  }

  handleBackAction() {
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

    // 2. If inside a sub-screen (Search, Library, Details) and not on Home, return to Home
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
