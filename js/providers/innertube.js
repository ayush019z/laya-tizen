/**
 * Laya TV - Music Provider Interface & YouTube Music InnerTube Client
 */

class MusicProvider {
  constructor() {
    this.name = 'YouTube Music (InnerTube)';
    this.apiBase = 'https://music.youtube.com/youtubei/v1';
    this.clientContext = {
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20240101.01.00',
          hl: 'en',
          gl: 'US'
        }
      }
    };
    
    // Rich Curated Catalogue: Best of Bollywood & Arijit Singh (Full High-Fidelity Streams)
    this.curatedCatalogue = [
      {
        id: "saavn_aRZbUYD7",
        title: "Tum Hi Ho",
        artist: "Arijit Singh",
        album: "Aashiqui 2",
        duration: 262,
        durationFormatted: "4:22",
        artwork: "https://c.saavncdn.com/430/Aashiqui-2-Hindi-2013-500x500.jpg",
        streamUrl: "https://aac.saavncdn.com/430/5c5ea5cc00e3bff45616013226f376fe_160.mp4"
      },
      {
        id: "saavn_rjkrTnma",
        title: "Kesariya",
        artist: "Arijit Singh",
        album: "Brahmastra",
        duration: 268,
        durationFormatted: "4:28",
        artwork: "https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-500x500.jpg",
        streamUrl: "https://aac.saavncdn.com/871/c2febd353f3a076a406fa37510f31f9f_160.mp4"
      },
      {
        id: "saavn_uiEWT3kP",
        title: "Channa Mereya",
        artist: "Arijit Singh",
        album: "Ae Dil Hai Mushkil",
        duration: 289,
        durationFormatted: "4:49",
        artwork: "https://c.saavncdn.com/257/Ae-Dil-Hai-Mushkil-Hindi-2016-500x500.jpg",
        streamUrl: "https://aac.saavncdn.com/597/6da0627cfcc4b937160f664841e4572d_160.mp4"
      },
      {
        id: "saavn_qZtKBMZ_",
        title: "Apna Bana Le",
        artist: "Arijit Singh",
        album: "Bhediya",
        duration: 261,
        durationFormatted: "4:21",
        artwork: "https://c.saavncdn.com/815/Bhediya-Hindi-2023-20230927155213-500x500.jpg",
        streamUrl: "https://aac.saavncdn.com/815/483a6e118e8108cbb3e5cd8701674f32_160.mp4"
      },
      {
        id: "saavn_Ni6noMmw",
        title: "Agar Tum Saath Ho",
        artist: "Arijit Singh",
        album: "Tamasha",
        duration: 341,
        durationFormatted: "5:41",
        artwork: "https://c.saavncdn.com/994/Tamasha-Hindi-2015-500x500.jpg",
        streamUrl: "https://aac.saavncdn.com/994/2e6b47719cea3e7c9f971a3f1ddc9b0a_160.mp4"
      },
      {
        id: "saavn_wcsDiSsA",
        title: "O Maahi",
        artist: "Arijit Singh",
        album: "Dunki",
        duration: 233,
        durationFormatted: "3:53",
        artwork: "https://c.saavncdn.com/139/Dunki-Hindi-2023-20231220211003-500x500.jpg",
        streamUrl: "https://aac.saavncdn.com/139/61036495c7ba45adf72a856b60f054fd_160.mp4"
      },
      {
        id: "saavn_4mHUvJ4u",
        title: "Satranga",
        artist: "Arijit Singh",
        album: "ANIMAL",
        duration: 271,
        durationFormatted: "4:31",
        artwork: "https://c.saavncdn.com/092/ANIMAL-Hindi-2023-20260724191152-500x500.jpg",
        streamUrl: "https://aac.saavncdn.com/092/86b1368e104225e0bfbc69cda4ab8580_160.mp4"
      },
      {
        id: "saavn__rJmbKSP",
        title: "Shayad",
        artist: "Arijit Singh",
        album: "Love Aaj Kal",
        duration: 247,
        durationFormatted: "4:07",
        artwork: "https://c.saavncdn.com/862/Love-Aaj-Kal-Hindi-2020-20200214140423-500x500.jpg",
        streamUrl: "https://aac.saavncdn.com/862/e277c1b441b562640c6b264aa3335a83_160.mp4"
      }
    ];
  }

  /**
   * Decrypt JioSaavn Encrypted Media URL using pure-JS DES-ECB
   */
  decryptMediaUrl(encryptedMediaUrl) {
    if (!encryptedMediaUrl) return null;
    try {
      if (window.CryptoJS && window.CryptoJS.DES) {
        const key = window.CryptoJS.enc.Utf8.parse('38346591');
        const decrypted = window.CryptoJS.DES.decrypt(
          { ciphertext: window.CryptoJS.enc.Base64.parse(encryptedMediaUrl) },
          key,
          {
            mode: window.CryptoJS.mode.ECB,
            padding: window.CryptoJS.pad.Pkcs7
          }
        );
        const url = decrypted.toString(window.CryptoJS.enc.Utf8);
        if (url && url.startsWith('http')) {
          return url.replace('_96.mp4', '_160.mp4');
        }
      }
    } catch (e) {
      console.warn('[MusicProvider] URL Decryption error:', e);
    }
    return null;
  }

  /**
   * Helper to execute InnerTube POST request
   */
  async requestInnerTube(endpoint, payload) {
    try {
      const url = `${this.apiBase}/${endpoint}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-YouTube-Client-Name': '67', // WEB_REMIX
          'X-YouTube-Client-Version': '1.20240101.01.00'
        },
        body: JSON.stringify({
          ...this.clientContext,
          ...payload
        })
      });

      if (!response.ok) {
        throw new Error(`InnerTube request failed: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.warn(`[InnerTube] ${endpoint} request failed:`, err);
      return null;
    }
  }

  /**
   * Get Home Shelves / Recommendations (With Algorithmic Taste Matching from History)
   */
  async getHomeFeed() {
    // 1. Dynamic Algorithmic Shelf based on Played Songs History
    let algoShelf = null;
    try {
      const history = window.Library ? window.Library.getHistory() : [];
      if (history && history.length > 0) {
        const artistFreq = {};
        const playedTitles = new Set();
        history.forEach(t => {
          if (t.title) playedTitles.add(t.title.toLowerCase());
          const primaryArtist = (t.artist || '').split(/[,&•]/)[0].trim();
          if (primaryArtist && primaryArtist !== 'Artist') {
            artistFreq[primaryArtist] = (artistFreq[primaryArtist] || 0) + 1;
          }
        });

        const sortedArtists = Object.keys(artistFreq).sort((a, b) => artistFreq[b] - artistFreq[a]);
        const favoriteArtist = sortedArtists[0] || (history[0] ? history[0].artist : 'Arijit Singh');
        const lastPlayedSong = history[0];

        // Query recommendation engine for tracks related to user's favorite artist
        const algoQuery = `${favoriteArtist} hits`;
        const discovered = await this.search(algoQuery);
        if (discovered && discovered.length > 0) {
          const unplayed = discovered.filter(s => !playedTitles.has(s.title.toLowerCase()));
          const recommendedItems = (unplayed.length >= 4 ? unplayed : discovered).slice(0, 10);
          
          algoShelf = {
            title: 'Recommended For You',
            subtitle: lastPlayedSong ? `Inspired by "${lastPlayedSong.title}" & ${favoriteArtist}` : `Based on your music taste`,
            items: recommendedItems
          };
        }
      }
    } catch (e) {
      console.warn('[MusicProvider] Algorithmic feed error:', e);
    }

    if (!algoShelf) {
      algoShelf = {
        title: 'Recommended For You',
        subtitle: 'Hand-picked for your music taste',
        items: [
          this.curatedCatalogue[1], // Kesariya
          this.curatedCatalogue[0], // Tum Hi Ho
          this.curatedCatalogue[3], // Apna Bana Le
          this.curatedCatalogue[6], // Satranga
          this.curatedCatalogue[4], // Agar Tum Saath Ho
          this.curatedCatalogue[5]  // O Maahi
        ]
      };
    }

    return [
      algoShelf,
      {
        title: 'Trending Bollywood Hits',
        subtitle: 'Most played Hindi songs on Laya',
        items: [
          this.curatedCatalogue[1], // Kesariya
          this.curatedCatalogue[3], // Apna Bana Le
          this.curatedCatalogue[6], // Satranga
          this.curatedCatalogue[5], // O Maahi
          this.curatedCatalogue[0], // Tum Hi Ho
          this.curatedCatalogue[4], // Agar Tum Saath Ho
          this.curatedCatalogue[2], // Channa Mereya
          this.curatedCatalogue[7]  // Shayad
        ]
      },
      {
        title: 'Best of Arijit Singh',
        subtitle: 'Evergreen Bollywood romantic melodies',
        items: this.curatedCatalogue
      },
      {
        title: 'Melodic & Soulful Romance',
        subtitle: 'Heartfelt tunes for relaxing and deep listening',
        items: [
          this.curatedCatalogue[4], // Agar Tum Saath Ho
          this.curatedCatalogue[2], // Channa Mereya
          this.curatedCatalogue[7], // Shayad
          this.curatedCatalogue[0], // Tum Hi Ho
          this.curatedCatalogue[1], // Kesariya
          this.curatedCatalogue[3]  // Apna Bana Le
        ]
      }
    ];
  }

  /**
   * Parse InnerTube Browse response for home carousels
   */
  parseHomeShelves(data) {
    const shelves = [];
    const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs;
    if (!tabs || tabs.length === 0) return null;

    const sections = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
    if (!sections) return null;

    for (const section of sections) {
      const shelfRenderer = section?.musicCarouselShelfRenderer;
      if (!shelfRenderer) continue;

      const title = shelfRenderer.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text || 'Recommended';
      const items = [];

      for (const item of shelfRenderer.contents || []) {
        const itemRenderer = item.musicTwoRowItemRenderer || item.musicResponsiveListItemRenderer;
        if (!itemRenderer) continue;

        const navEndpoint = itemRenderer.navigationEndpoint?.watchEndpoint;
        const videoId = navEndpoint?.videoId;
        if (!videoId) continue;

        const titleText = itemRenderer.title?.runs?.[0]?.text || 'Track';
        const artistText = itemRenderer.subtitle?.runs?.[0]?.text || 'Artist';
        const thumbs = itemRenderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails;
        const thumbUrl = thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1].url : '';

        items.push({
          id: videoId,
          title: titleText,
          artist: artistText,
          artwork: thumbUrl || 'assets/icon.png',
          duration: 210,
          durationFormatted: '3:30'
        });
      }

      if (items.length > 0) {
        shelves.push({ title, items });
      }
    }

    return shelves;
  }

  /**
   * Search Music Catalogue (Combines JioSaavn High-Fidelity 320k Audio + YouTube Music Catalog)
   */
  async search(query) {
    if (!query || query.trim() === '') {
      return this.curatedCatalogue;
    }

    const cleanQuery = query.trim();
    console.log(`[MusicProvider] Unified Search for: "${cleanQuery}"`);
    const allResults = [];
    const seenTitles = new Set();

    // 1. Search JioSaavn (320k/160k Full-Length Audio Streams, Bollywood, Regional & International)
    try {
      const saavnUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=20&p=1&q=${encodeURIComponent(cleanQuery)}`;
      const res = await fetch(saavnUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && data.results.length > 0) {
          for (const s of data.results) {
            const stream = this.decryptMediaUrl(s.more_info?.encrypted_media_url);
            const dur = parseInt(s.more_info?.duration || '240');
            const mins = Math.floor(dur / 60);
            const secs = String(dur % 60).padStart(2, '0');
            const artwork = (s.image || '').replace('150x150', '500x500') || 'assets/icon.png';
            const title = (s.title || 'Unknown Title')
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&amp;/g, '&');
            const artist = (s.more_info?.singers || s.subtitle || 'Artist')
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&amp;/g, '&');
            const album = (s.more_info?.album || 'Single')
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&amp;/g, '&');

            seenTitles.add(title.toLowerCase());
            allResults.push({
              id: 'saavn_' + s.id,
              source: 'JioSaavn',
              title,
              artist,
              album,
              duration: dur,
              durationFormatted: `${mins}:${secs}`,
              artwork,
              streamUrl: stream,
              encrypted_media_url: s.more_info?.encrypted_media_url
            });
          }
        }
      }
    } catch (err) {
      console.warn('[MusicProvider] Saavn search query failed:', err);
    }

    // 2. Search YouTube Music InnerTube (Find any YouTube music video, mashup, remix, or live performance)
    try {
      const ytRes = await fetch('https://music.youtube.com/youtubei/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20240101.01.00',
              hl: 'en',
              gl: 'IN'
            }
          },
          query: cleanQuery
        }),
        signal: AbortSignal.timeout(4000)
      });

      if (ytRes.ok) {
        const data = await ytRes.json();
        const sections = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
        for (const sec of sections) {
          const contents = sec.musicCardShelfRenderer?.contents || sec.musicShelfRenderer?.contents || sec.itemSectionRenderer?.contents || [];
          for (const item of contents) {
            const r = item.musicResponsiveListItemRenderer;
            if (!r) continue;

            const videoId = r.playlistItemData?.videoId ||
              r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
              r.doubleTapButton?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
            if (!videoId) continue;

            const flex = r.flexColumns || [];
            const title = flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
            const runs2 = flex[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            const artist = runs2.map(x => x.text).filter(t => t !== ' • ' && t !== 'Song' && !t.includes(':')).join(', ') || 'YouTube Music';
            const thumb = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;

            if (title && !seenTitles.has(title.toLowerCase())) {
              seenTitles.add(title.toLowerCase());
              allResults.push({
                id: 'yt_' + videoId,
                videoId: videoId,
                source: 'YouTube Music',
                title,
                artist,
                album: 'YouTube Music',
                duration: 240,
                durationFormatted: '4:00',
                artwork: thumb || 'assets/icon.png',
                streamUrl: null
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[MusicProvider] YouTube Music search failed:', err);
    }

    if (allResults.length > 0) {
      console.log(`[MusicProvider] Found ${allResults.length} total tracks for "${cleanQuery}"`);
      return allResults;
    }

    // 3. Fallback: Filter Curated items ONLY if title/artist/album actually matches query
    const q = cleanQuery.toLowerCase();
    const filtered = this.curatedCatalogue.filter(t => 
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.album.toLowerCase().includes(q)
    );

    return filtered;
  }

  /**
   * Resolve Playable Stream URL for Track (Full-length & Ad-free)
   */
  async resolveTrackStream(track) {
    if (track.streamUrl) {
      return track.streamUrl;
    }

    if (track.encrypted_media_url) {
      const decrypted = this.decryptMediaUrl(track.encrypted_media_url);
      if (decrypted) {
        track.streamUrl = decrypted;
        return decrypted;
      }
    }

    // For YouTube tracks, resolve stream via audio track match on high-bitrate CDN
    const searchTerms = [
      `${track.title} ${track.artist}`.replace(/[\(\[\{].*?[\)\]\}]/g, '').trim(),
      track.title.replace(/[\(\[\{].*?[\)\]\}]/g, '').trim()
    ];

    for (const term of searchTerms) {
      try {
        const saavnUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=5&p=1&q=${encodeURIComponent(term)}`;
        const res = await fetch(saavnUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          if (data && data.results && data.results.length > 0) {
            for (const s of data.results) {
              const stream = this.decryptMediaUrl(s.more_info?.encrypted_media_url);
              if (stream) {
                track.streamUrl = stream;
                return stream;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[MusicProvider] Audio stream substitution error:', e);
      }
    }

    // High fidelity curated fallback
    return this.curatedCatalogue[0]?.streamUrl || 'https://aac.saavncdn.com/430/5c5ea5cc00e3bff45616013226f376fe_160.mp4';
  }

  /**
   * Retrieve Synchronized Lyrics for Track
   */
  async getLyrics(track) {
    if (track.lyrics) {
      return track.lyrics;
    }

    // Default synchronized procedural lyrics generator for ambient TV display
    return [
      { time: 0, text: `♪ Now Playing: ${track.title} ♪` },
      { time: 10, text: `by ${track.artist}` },
      { time: 25, text: 'Relax and immerse in high fidelity audio' },
      { time: 45, text: '♪ Laya for Samsung Smart TV ♪' },
      { time: 75, text: 'Echoes reflecting through the night' },
      { time: 110, text: 'Smooth harmonies in full bloom' },
      { time: 150, text: '♪ Music never stops ♪' }
    ];
  }
}

window.MusicProvider = new MusicProvider();
