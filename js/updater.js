/**
 * Laya TV - Over-The-Air (OTA) In-TV Auto-Updater
 * 
 * Allows Samsung Tizen TV to update styles, providers, and app logic
 * over the network without requiring a PC, laptop, or reinstallation via Apps2Samsung.
 */
class AppUpdater {
  constructor() {
    this.currentVersion = '1.3.4';
    this.currentBuild = 130;
    this.defaultUpdateUrl = 'https://raw.githubusercontent.com/ayush019z/laya-tizen/main/version.json';
    this.updateUrl = localStorage.getItem('layatv_ota_url') || this.defaultUpdateUrl;
    this.isAutoUpdateEnabled = localStorage.getItem('layatv_ota_autocheck') !== 'false';
    this.activeVersion = localStorage.getItem('layatv_active_version') || this.currentVersion;
    this.status = 'idle'; // 'idle', 'checking', 'available', 'downloading', 'ready', 'up-to-date', 'error'
    this.remoteData = null;

    // Check updates after startup
    if (this.isAutoUpdateEnabled) {
      setTimeout(() => this.checkForUpdates(false), 3000);
    }
  }

  async checkForUpdates(manual = false) {
    this.status = 'checking';
    this.notifyUI();

    if (manual && window.UIController) {
      window.UIController.showToast('Checking for Laya updates...');
    }

    try {
      // Append cache-busting timestamp
      const checkUrl = `${this.updateUrl}?_t=${Date.now()}`;
      const response = await fetch(checkUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Update server returned status ${response.status}`);
      }

      const remote = await response.json();
      this.remoteData = remote;

      const hasUpdate = this.compareVersions(remote.version, this.activeVersion) > 0;

      if (hasUpdate) {
        this.status = 'available';
        this.notifyUI();
        if (window.UIController) {
          window.UIController.showToast(`New update v${remote.version} available!`);
        }
        // Auto-download update if enabled
        if (this.isAutoUpdateEnabled) {
          await this.downloadAndApplyUpdate(remote);
        }
      } else {
        this.status = 'up-to-date';
        this.notifyUI();
        if (manual && window.UIController) {
          window.UIController.showToast(`Laya is up to date (v${this.activeVersion})`);
        }
      }
    } catch (err) {
      console.warn('[Updater] Check failed:', err);
      this.status = 'error';
      this.notifyUI();
      if (manual && window.UIController) {
        window.UIController.showToast('Unable to reach update server');
      }
    }
  }

  async downloadAndApplyUpdate(remote) {
    this.status = 'downloading';
    this.notifyUI();

    if (window.UIController) {
      window.UIController.showToast(`Downloading Laya v${remote.version}...`);
    }

    try {
      const baseUrl = remote.bundleBaseUrl || this.updateUrl.replace(/version\.json.*$/, '');
      const filesToUpdate = remote.files || [
        'css/app.css',
        'js/providers/innertube.js',
        'js/player/audio-controller.js',
        'js/ui/views.js'
      ];

      // Download each file and cache into localStorage
      for (const file of filesToUpdate) {
        const fileUrl = `${baseUrl}${file}?_t=${Date.now()}`;
        const res = await fetch(fileUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to download ${file}`);
        const content = await res.text();
        localStorage.setItem(`layatv_ota_file_${file}`, content);
      }

      // Record active version
      localStorage.setItem('layatv_active_version', remote.version);
      this.activeVersion = remote.version;
      this.status = 'ready';
      this.notifyUI();

      if (window.UIController) {
        window.UIController.showToast(`Update v${remote.version} ready! Restarting...`);
      }

      // Reload application to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error('[Updater] Download failed:', err);
      this.status = 'error';
      this.notifyUI();
      if (window.UIController) {
        window.UIController.showToast('Update download failed. Using local files.');
      }
    }
  }

  resetToFactory() {
    // Clear all OTA caches
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('layatv_ota_file_')) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem('layatv_active_version');
    this.activeVersion = this.currentVersion;
    this.status = 'idle';
    this.notifyUI();

    if (window.UIController) {
      window.UIController.showToast('Reset to factory bundle. Reloading...');
    }

    setTimeout(() => {
      window.location.reload();
    }, 1200);
  }

  setUpdateUrl(newUrl) {
    if (newUrl && newUrl.trim() !== '') {
      this.updateUrl = newUrl.trim();
      localStorage.setItem('layatv_ota_url', this.updateUrl);
      if (window.UIController) {
        window.UIController.showToast('Update channel saved');
      }
      this.checkForUpdates(true);
    }
  }

  compareVersions(v1, v2) {
    const p1 = (v1 || '0').split('.').map(Number);
    const p2 = (v2 || '0').split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  notifyUI() {
    const statusElem = document.getElementById('ota-status-label');
    if (statusElem) {
      switch (this.status) {
        case 'checking':
          statusElem.textContent = 'Checking for updates...';
          statusElem.style.color = 'var(--accent-blue)';
          break;
        case 'available':
          statusElem.textContent = `Update v${this.remoteData?.version} available!`;
          statusElem.style.color = 'var(--accent-pink)';
          break;
        case 'downloading':
          statusElem.textContent = 'Downloading update files...';
          statusElem.style.color = 'var(--accent-pink)';
          break;
        case 'ready':
          statusElem.textContent = 'Update downloaded! Applying...';
          statusElem.style.color = '#4ade80';
          break;
        case 'up-to-date':
          statusElem.textContent = `Up to date (v${this.activeVersion})`;
          statusElem.style.color = '#4ade80';
          break;
        case 'error':
          statusElem.textContent = 'Check failed (offline or server error)';
          statusElem.style.color = '#f87171';
          break;
        default:
          statusElem.textContent = `Running v${this.activeVersion}`;
          statusElem.style.color = 'var(--text-muted)';
      }
    }
  }
}

// Global instance
window.Updater = new AppUpdater();
