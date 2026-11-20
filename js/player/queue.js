/**
 * Laya TV - Playback Queue & Playlist Management
 */
class PlaybackQueue {
  constructor() {
    this.tracks = [];
    this.currentIndex = -1;
    this.repeatMode = 'all'; // 'none', 'all', 'one'
    this.isShuffled = false;
    this.autoplayEnabled = true; // Infinite Radio Mode
    this.listeners = [];
    this._fetchingAutoplay = false;
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  notify() {
    this.listeners.forEach(cb => cb(this));
  }

  setQueue(trackList, startIndex = 0) {
    this.tracks = [...trackList];
    this.currentIndex = Math.max(0, Math.min(startIndex, this.tracks.length - 1));
    this.notify();
    this.checkAndTriggerAutoplay();
  }

  getCurrentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.tracks.length) {
      return this.tracks[this.currentIndex];
    }
    return null;
  }

  getNextTrack() {
    if (this.tracks.length === 0) return null;
    
    if (this.repeatMode === 'one') {
      return this.getCurrentTrack();
    }

    if (this.currentIndex + 1 < this.tracks.length) {
      return this.tracks[this.currentIndex + 1];
    } else if (this.repeatMode === 'all') {
      return this.tracks[0];
    }
    return null;
  }

  getPreviousTrack() {
    if (this.tracks.length === 0) return null;
    if (this.currentIndex - 1 >= 0) {
      return this.tracks[this.currentIndex - 1];
    } else if (this.repeatMode === 'all') {
      return this.tracks[this.tracks.length - 1];
    }
    return this.tracks[0];
  }

  advance() {
    if (this.repeatMode === 'one') return this.getCurrentTrack();

    // Infinite Radio Autoplay: When near the end of the queue, dynamically pull more related tracks
    if (this.currentIndex >= this.tracks.length - 2 && this.autoplayEnabled) {
      this.checkAndTriggerAutoplay();
    }

    if (this.currentIndex + 1 < this.tracks.length) {
      this.currentIndex++;
    } else if (this.repeatMode === 'all') {
      this.currentIndex = 0;
    }
    this.notify();
    return this.getCurrentTrack();
  }

  async checkAndTriggerAutoplay() {
    if (!this.autoplayEnabled || this._fetchingAutoplay) return;
    const current = this.getCurrentTrack();
    if (!current || !window.MusicProvider) return;

    // Only fetch if 2 or fewer tracks remain ahead
    if (this.tracks.length - this.currentIndex > 3) return;

    this._fetchingAutoplay = true;
    try {
      const radioTracks = await window.MusicProvider.getRelatedRadioTracks(current, this.tracks);
      if (radioTracks && radioTracks.length > 0) {
        radioTracks.forEach(t => this.tracks.push(t));
        this.notify();
        if (window.UIController) {
          window.UIController.showToast(`📻 Infinite Radio: Queued ${radioTracks.length} similar tracks`);
        }
      }
    } catch (e) {
      console.warn('[Queue] Infinite radio autoplay error:', e);
    } finally {
      this._fetchingAutoplay = false;
    }
  }

  retreat() {
    if (this.currentIndex - 1 >= 0) {
      this.currentIndex--;
    } else if (this.repeatMode === 'all') {
      this.currentIndex = this.tracks.length - 1;
    }
    this.notify();
    return this.getCurrentTrack();
  }

  addTrack(track) {
    this.tracks.push(track);
    if (this.currentIndex === -1) {
      this.currentIndex = 0;
    }
    this.notify();
  }

  toggleRepeat() {
    if (this.repeatMode === 'all') this.repeatMode = 'one';
    else if (this.repeatMode === 'one') this.repeatMode = 'none';
    else this.repeatMode = 'all';
    this.notify();
    return this.repeatMode;
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    if (this.isShuffled) {
      const current = this.getCurrentTrack();
      // Fisher-Yates shuffle remaining
      for (let i = this.tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
      }
      if (current) {
        this.currentIndex = this.tracks.indexOf(current);
      }
    }
    this.notify();
    return this.isShuffled;
  }
}

window.Queue = new PlaybackQueue();
