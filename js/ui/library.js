/**
 * Laya TV - Persistent Local Library, Favorites & Listening History Store
 */
class LibraryStore {
  constructor() {
    this.storageKeyFavorites = 'layatv_favorites';
    this.storageKeyHistory = 'layatv_history';
    this.favorites = this.load(this.storageKeyFavorites, []);
    this.history = this.load(this.storageKeyHistory, [
      {
        id: 'curated_espresso',
        title: 'Espresso',
        artist: 'Sabrina Carpenter',
        album: 'Short n\' Sweet',
        artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        durationFormatted: '2:55',
        playedAt: Date.now() - 5 * 60 * 1000 // 5m ago
      },
      {
        id: 'curated_1',
        title: 'Midnight City Beats',
        artist: 'Laya Chillwave',
        album: 'Neon Horizon',
        artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
        durationFormatted: '3:38',
        playedAt: Date.now() - 45 * 60 * 1000 // 45m ago
      },
      {
        id: 'curated_2',
        title: 'Starfall Reverie',
        artist: 'Aura Soundscapes',
        album: 'Cosmic Journey',
        artwork: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
        durationFormatted: '3:15',
        playedAt: Date.now() - 120 * 60 * 1000 // 2h ago
      }
    ]);
  }

  load(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  toggleFavorite(track) {
    if (!track) return false;
    const exists = this.isFavorite(track.id);
    if (exists) {
      this.favorites = this.favorites.filter(t => t.id !== track.id);
      this.save(this.storageKeyFavorites, this.favorites);
      if (window.UIController) window.UIController.showToast('Removed from Liked Songs');
      return false;
    } else {
      this.favorites.unshift(track);
      this.save(this.storageKeyFavorites, this.favorites);
      if (window.UIController) window.UIController.showToast('Added to Liked Songs ❤️');
      return true;
    }
  }

  isFavorite(trackId) {
    return this.favorites.some(t => t.id === trackId);
  }

  addHistory(track) {
    if (!track) return;
    this.history = this.history.filter(t => t.id !== track.id);
    this.history.unshift({
      ...track,
      playedAt: Date.now()
    });
    if (this.history.length > 80) {
      this.history.pop();
    }
    this.save(this.storageKeyHistory, this.history);
  }

  clearHistory() {
    this.history = [];
    this.save(this.storageKeyHistory, this.history);
    if (window.UIController) {
      window.UIController.showToast('Listening history cleared');
    }
  }

  getFavorites() {
    return this.favorites;
  }

  getHistory() {
    return this.history;
  }

  getRelativeTime(timestamp) {
    if (!timestamp) return 'Recently';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
}

window.Library = new LibraryStore();
