# Laya for Samsung Tizen Smart TVs

An independent, television-tailored music application inspired by the open-source [Laya](https://github.com/impin2rex/Laya) project, designed from the ground up for **Samsung Smart TVs running Tizen OS** (including modern 2026 Mini LED models such as the **Samsung UA55M2EHAULXL**).

---

## Key Features

* **10-Foot Television User Interface:**
  * 1920x1080 design reference frame smoothly scaled to 4K displays.
  * High-visibility focus indicators with dynamic glow and zoom animations.
  * Designed exclusively for comfortable navigation using only the Samsung TV physical remote D-pad.

* **2D Spatial Navigation & Hardware Remote Integration:**
  * Custom 2D spatial navigation engine calculating Euclidean direction vectors for D-pad navigation.
  * Automatic focus tracking and graceful focus restoration.
  * Tizen TV input device API registration for hardware remote media keys: `Play`, `Pause`, `Play/Pause`, `FastForward`, `Rewind`, `Next`, `Previous`.
  * Dedicated Samsung Back/Return key (KeyCode `10009`) handler managing overlay dismissals and view hierarchies without exiting abruptly.

* **Rich Music Discovery & InnerTube Provider:**
  * YouTube Music InnerTube client architecture with support for Home shelves ("Quick Picks", "Trending Now", "Relax & Focus"), Search, and Stream resolution.
  * Curated audio catalogue and offline fallbacks ensuring instant, reliable playback under any network condition.

* **Fullscreen Now Playing Experience:**
  * Ambient blurred album artwork background matching the currently playing track.
  * Dynamic playback scrubber with current elapsed and total duration.
  * Media controls: Shuffle, Previous, Play/Pause, Next, Repeat modes (`all`, `one`, `none`).

* **Synchronized Karaoke-Style Lyrics:**
  * Real-time synchronized LRC line tracking based on audio playback time.
  * Automatic smooth scrolling centering the active lyric line with glowing neon typography.

* **10-Foot On-Screen TV Keyboard:**
  * Full alphabet and numeric TV keyboard navigable with remote arrows and Enter, plus integration with Samsung TV OS virtual IME.

* **Persistent Local Library:**
  * Favorites and Recent listening history saved directly to TV local storage (`localStorage`).

* **Seamless Mini-Player:**
  * Persistent playback bar across Home, Search, and Library views.
  * One-click expansion into the Fullscreen Now Playing screen.

---

## Installation via Apps2Samsung

**Apps2Samsung** is a utility designed to install `.wgt` packages directly to Samsung Smart TVs over your local network:

1. **Enable Developer Mode on your Samsung TV:**
   * On your Samsung TV, open the **Apps** panel.
   * On your physical remote, enter the sequence: `1, 2, 3, 4, 5`.
   * When the Developer Mode dialog appears, toggle **Developer Mode** to **ON**.
   * Enter the IP address of your computer running Apps2Samsung.
   * Restart your TV (hold the Power button on the remote until the TV turns off and on again).

2. **Locate the `.wgt` Package:**
   * Use the pre-built `laya-tv.wgt` generated in this folder:
     `C:\Users\gamin\.gemini\antigravity\scratch\laya-tizen\laya-tv.wgt`

3. **Install with Apps2Samsung:**
   * Open **Apps2Samsung** on your PC.
   * Enter your TV's local IP address and click **Connect**.
   * Drag and drop or browse to `laya-tv.wgt`.
   * Click **Install** / **Send to TV**. Apps2Samsung will handle certificate signing and push the application directly to your TV.
   * Laya will appear on your TV's home launcher ribbon.

---

## Manual Build & SDB Deployment (Alternative)

If using **Tizen Studio** command-line tools:

```bash
# Package into .wgt
tizen package -t wgt -s <your-security-profile> -- .

# Install to TV via SDB
sdb connect <tv-ip-address>
sdb install laya-tv.wgt
```

---

## Project Structure

```
laya-tizen/
├── config.xml                  # Tizen TV Web Application Manifest & Privileges
├── index.html                  # 10-ft TV Layout & Shell
├── css/
│   └── app.css                 # Dark theme styling, focus rings, layouts
├── js/
│   ├── navigation/
│   │   ├── spatial-nav.js      # 2D D-pad directional focus engine
│   │   └── remote-keys.js      # Samsung Tizen TV remote key registration & Back handling
│   ├── providers/
│   │   └── innertube.js        # YouTube Music InnerTube API & Curated fallback client
│   ├── player/
│   │   ├── audio-controller.js # Audio streaming engine & timeupdate events
│   │   └── queue.js            # Queue, repeat, and shuffle management
│   └── ui/
│       ├── library.js          # Persistent local storage (Favorites, Recents)
│       └── views.js            # View routing, Virtual TV keyboard, Lyrics ticker
└── assets/
    └── icon.png                # TV Application launcher icon (256x256 PNG)
```

---

## License

This project is licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE) in alignment with upstream open-source music streaming applications.


---

## Over-The-Air (OTA) In-TV Auto-Updates

Laya includes an **Over-The-Air (OTA) dynamic update engine**. Once installed on your Samsung TV via Apps2Samsung for the first time, **you do not need your laptop or PC to install future updates**.

### How It Works

1. **Native Tizen Shell:**
   The `.wgt` file installed on the TV provides the native TV hardware bindings (Samsung TV remote keys, D-pad spatial navigation, 10-ft viewport, audio background playback).

2. **Dynamic OTA Update Engine (`js/updater.js`):**
   * On launch, the TV silently checks the remote `version.json` over Wi-Fi.
   * If a new version is detected (e.g. `1.0.1` vs `1.0.0`):
     * The TV downloads the updated styles and scripts into persistent TV storage (`localStorage`).
     * The app applies the update and reloads in under 2 seconds.
   * If the TV is offline or the remote URL is unreachable, it automatically uses the local bundled version so the app **never breaks or fails to start**.

3. **In-TV Update Settings:**
   * Open the **Settings** tab on your TV using the remote.
   * View the active version, check for updates manually with one click, or reset to factory defaults.
   * Change or customize your update channel URL (e.g. pointing to your own GitHub repo).

### How to Release an Update from GitHub

Whenever you make improvements to Laya:
1. Push your updated files (`css/app.css`, `js/providers/innertube.js`, `js/ui/views.js`, etc.) to your GitHub repository or web host.
2. In `version.json`, increment the `"version"` field (e.g. `"1.0.1"`) and update `"releaseDate"`.
3. That's it! When you turn on your Samsung TV, Laya will automatically download the new update over Wi-Fi and refresh itself.
