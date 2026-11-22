/**
 * Laya TV - Universal Multi-Platform Playlist Importer
 * Supports: Spotify, JioSaavn, Apple Music, YouTube Music & Raw Text Songlists
 */

class PlaylistImporter {
  constructor() {
    this.isImporting = false;
  }

  /**
   * Main import dispatcher based on link format or text
   */
  async importPlaylist(urlOrText, onProgress) {
    return await this.importFromUrl(urlOrText, onProgress);
  }

  async importFromUrl(urlOrText, onProgress) {
    if (!urlOrText || typeof urlOrText !== 'string') {
      throw new Error('Please provide a valid playlist link or song list');
    }

    const input = urlOrText.trim();
    this.isImporting = true;

    try {
      if (input.includes('spotify.com')) {
        return await this.importSpotify(input, onProgress);
      } else if (input.includes('jiosaavn.com') || input.includes('saavn.com')) {
        return await this.importJioSaavn(input, onProgress);
      } else if (input.includes('music.apple.com') || input.includes('itunes.apple.com')) {
        return await this.importAppleMusic(input, onProgress);
      } else if (input.includes('youtube.com') || input.includes('youtu.be')) {
        return await this.importYouTube(input, onProgress);
      } else {
        // Assume text list of tracks (e.g. "Tum Hi Ho\nKesariya")
        return await this.importFromRawText(input, onProgress);
      }
    } finally {
      this.isImporting = false;
    }
  }

  /**
   * 1. Spotify Playlist Importer
   */
  async importSpotify(url) {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/i) || url.match(/album\/([a-zA-Z0-9]+)/i);
    if (!match) {
      throw new Error('Could not parse Spotify playlist ID from URL');
    }
    const id = match[1];
    const isAlbum = url.includes('/album/');
    const embedUrl = `https://open.spotify.com/embed/${isAlbum ? 'album' : 'playlist'}/${id}`;

    // Fetch embed HTML
    const res = await fetch(embedUrl);
    if (!res.ok) {
      throw new Error('Failed to load Spotify playlist embed. Ensure the playlist is public.');
    }

    const html = await res.text();
    let name = 'Spotify Playlist';
    const rawTrackList = [];

    // Parse __NEXT_DATA__ JSON from Spotify embed
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const entity = nextData?.props?.pageProps?.state?.data?.entity;
        if (entity) {
          name = entity.name || entity.title || name;
          const trackList = entity.trackList || entity.tracks?.items || [];
          trackList.forEach(t => {
            const title = t.title || t.name;
            const artist = (t.artists && t.artists[0]?.name) || t.subtitle || '';
            if (title) {
              rawTrackList.push({ title, artist });
            }
          });
        }
      } catch (e) {}
    }

    // Fallback: Parse track rows from HTML if JSON parse failed
    if (rawTrackList.length === 0) {
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) name = titleMatch[1].replace(/\|.*$/i, '').trim();

      const regex = /data-testid="track-row"[\s\S]*?<div dir="auto"[^>]*>([^<]+)<\/div>[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
      let m;
      while ((m = regex.exec(html)) !== null) {
        rawTrackList.push({ title: m[1].trim(), artist: m[2].trim() });
      }
    }

    if (rawTrackList.length === 0) {
      throw new Error('No tracks found in Spotify playlist. Please check link.');
    }

    // Resolve tracks into Laya playable tracks
    return await this.resolveAndSaveTracks(name, rawTrackList, url);
  }

  /**
   * 2. JioSaavn Playlist Importer
   */
  async importJioSaavn(url) {
    let name = 'JioSaavn Playlist';
    const rawTrackList = [];

    // Try Saavn Public API endpoint
    try {
      const apiUrl = `https://saavn.dev/api/playlists?link=${encodeURIComponent(url)}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        const plData = data?.data;
        if (plData) {
          name = plData.name || name;
          if (Array.isArray(plData.songs)) {
            plData.songs.forEach(s => {
              rawTrackList.push({
                title: s.name,
                artist: s.primaryArtists || s.singers || '',
                artwork: window.getHighQualityArtwork ? window.getHighQualityArtwork(s.image && s.image[2] ? s.image[2].link : (s.image || '')) : (s.image && s.image[2] ? s.image[2].link : '')
              });
            });
          }
        }
      }
    } catch (e) {}

    // Fallback scrape if public API is blocked
    if (rawTrackList.length === 0) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const html = await res.text();
          const titleMatch = html.match(/<title>(.*?)<\/title>/i);
          if (titleMatch) name = titleMatch[1].replace(/\|.*$/i, '').trim();

          const songMatches = html.matchAll(/class="o-list-song__title"[^>]*>([^<]+)<\/a>/g);
          for (const m of songMatches) {
            rawTrackList.push({ title: m[1].trim(), artist: '' });
          }
        }
      } catch (e) {}
    }

    if (rawTrackList.length === 0) {
      throw new Error('Could not retrieve tracks from JioSaavn playlist. Ensure link is public.');
    }

    return await this.resolveAndSaveTracks(name, rawTrackList, url);
  }

  /**
   * 3. Apple Music Playlist & Album Importer
   */
  async importAppleMusic(url, onProgress) {
    let name = 'Apple Music Playlist';
    const rawTrackList = [];

    if (typeof onProgress === 'function') onProgress(15, 'Fetching Apple Music tracklist...');

    // 1. If URL has an iTunes/Apple Music numeric ID (e.g. album or song: /album/name/123456789 or id=123456789)
    const idMatch = url.match(/\/album\/[^/]+\/([0-9]+)/i) || url.match(/[\?&]id=([0-9]+)/i) || url.match(/\/id([0-9]+)/i);
    if (idMatch && idMatch[1]) {
      try {
        const itunesUrl = `https://itunes.apple.com/lookup?id=${idMatch[1]}&entity=song`;
        const res = await fetch(itunesUrl);
        if (res.ok) {
          const json = await res.json();
          if (json && json.results && json.results.length > 0) {
            const first = json.results[0];
            name = first.collectionName || first.trackName || name;
            json.results.forEach(item => {
              if (item.wrapperType === 'track' || item.trackName) {
                rawTrackList.push({
                  title: item.trackName,
                  artist: item.artistName || '',
                  artwork: window.getHighQualityArtwork ? window.getHighQualityArtwork(item.artworkUrl100 || item.artworkUrl60 || '') : (item.artworkUrl100 || item.artworkUrl60 || '')
                });
              }
            });
          }
        }
      } catch (e) {
        console.warn('iTunes API lookup fallback:', e);
      }
    }

    // 2. Fetch HTML directly or via proxy to parse LD+JSON & serialized data
    if (rawTrackList.length === 0) {
      let html = '';
      const fetchTargets = [
        url,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(url)}`
      ];

      for (const target of fetchTargets) {
        try {
          const res = await fetch(target, { cache: 'no-cache' });
          if (res.ok) {
            const text = await res.text();
            if (text && (text.includes('application/ld+json') || text.includes('music:song') || text.includes('serialized-server-data'))) {
              html = text;
              break;
            }
          }
        } catch (err) {
          // continue to next proxy
        }
      }

      if (html) {
        // Extract title
        const ogTitleMatch = html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i) || html.match(/<title>([^<]+)<\/title>/i);
        if (ogTitleMatch) {
          name = ogTitleMatch[1].replace(/on Apple Music/gi, '').replace(/- Playlist - Apple Music/gi, '').trim();
        }

        // Strategy A: LD+JSON
        const ldMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        for (const m of ldMatches) {
          try {
            const ld = JSON.parse(m[1]);
            const tracks = Array.isArray(ld.track) ? ld.track : (Array.isArray(ld) ? ld : []);
            if (tracks.length > 0) {
              if (ld.name) name = ld.name;
              tracks.forEach(t => {
                const title = t.name || t.title;
                const artist = t.byArtist?.name || t.author?.name || '';
                if (title) {
                  rawTrackList.push({
                    title,
                    artist,
                    artwork: t.audio?.thumbnailUrl || t.thumbnailUrl || ''
                  });
                }
              });
              if (rawTrackList.length > 0) break;
            }
          } catch (e) {}
        }

        // Strategy B: serialized-server-data JSON
        if (rawTrackList.length === 0) {
          const sMatch = html.match(/<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i) ||
                         html.match(/<script[^>]*type=["']application\/json["'][^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i);
          if (sMatch) {
            try {
              const sJson = JSON.parse(sMatch[1]);
              const sections = sJson.data?.[0]?.data?.sections || [];
              sections.forEach(sec => {
                if (Array.isArray(sec.items)) {
                  sec.items.forEach(it => {
                    const title = it.title;
                    const artist = it.artistName || it.subtitle || '';
                    if (title) {
                      rawTrackList.push({ title, artist });
                    }
                  });
                }
              });
            } catch (e) {}
          }
        }

        // Strategy C: Meta tags music:song URL slugs
        if (rawTrackList.length === 0) {
          const songMeta = html.matchAll(/<meta property=["']music:song["'] content=["'][^"']*\/song\/([^/]+)\/[0-9]+["']/gi);
          for (const sm of songMeta) {
            const songName = decodeURIComponent(sm[1]).replace(/-/g, ' ');
            if (songName) {
              rawTrackList.push({ title: songName, artist: '' });
            }
          }
        }
      }
    }

    if (rawTrackList.length === 0) {
      throw new Error('Could not parse song names from Apple Music link. Please ensure the link is public.');
    }

    if (typeof onProgress === 'function') onProgress(30, `Found ${rawTrackList.length} songs. Matching audio streams...`);

    return await this.resolveAndSaveTracks(name, rawTrackList, url, onProgress);
  }

  /**
   * 4. YouTube Music Playlist Importer
   */
  async importYouTube(url) {
    const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    if (!listMatch) {
      throw new Error('No YouTube playlist ID found in URL.');
    }
    const listId = listMatch[1];
    const name = `YouTube Playlist (${listId.substring(0, 6)})`;

    // Query InnerTube or search for playlist
    const tracks = await window.MusicProvider.search(url);
    if (!tracks || tracks.length === 0) {
      throw new Error('Could not find tracks in YouTube playlist.');
    }

    return window.Library.savePlaylist(name, tracks, url);
  }

  /**
   * 5. Raw Text Songlist (e.g. pasted 10 song titles)
   */
  async importFromRawText(text) {
    const lines = text.split(/[\r\n]+/)
      .map(l => l.trim().replace(/^[\d+.)\-–—*•\s]+/, '').trim())
      .filter(l => l.length > 2);

    if (lines.length === 0) {
      throw new Error('Please enter at least one song title.');
    }

    const rawTrackList = lines.map(line => {
      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        return { title: parts[0].trim(), artist: parts[1].trim() };
      }
      return { title: line, artist: '' };
    });

    const name = `Imported Mix (${lines.length} Songs)`;
    return await this.resolveAndSaveTracks(name, rawTrackList, 'Manual Input');
  }

  /**
   * Smart Song Matcher: Compares candidate results against target track title and artist
   * to guarantee the exact song is matched instead of a random or wrong song.
   */
  findBestMatch(item, candidates) {
    if (!candidates || candidates.length === 0) return null;

    const clean = (s) => (s || '').toLowerCase()
      .replace(/[\(\[\{].*?[\)\]\}]/g, '')
      .replace(/[-–—]/g, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const targetTitle = clean(item.title);
    const targetArtist = clean(item.artist);
    const targetArtistWords = targetArtist.split(' ').filter(w => w.length > 2);

    let bestScore = -1;
    let bestCandidate = null;

    for (const c of candidates) {
      let score = 0;
      const cTitle = clean(c.title);
      const cArtist = clean(c.artist);

      // Exact title match
      if (cTitle === targetTitle) {
        score += 80;
      } else if (cTitle.includes(targetTitle) || targetTitle.includes(cTitle)) {
        score += 55;
      } else {
        const tWords = targetTitle.split(' ').filter(w => w.length > 2);
        const matchWords = tWords.filter(w => cTitle.includes(w));
        if (matchWords.length > 0) {
          score += (matchWords.length / Math.max(1, tWords.length)) * 40;
        }
      }

      // Artist match
      if (targetArtistWords.length > 0) {
        let artistMatches = 0;
        for (const w of targetArtistWords) {
          if (cArtist.includes(w)) {
            artistMatches++;
          }
        }
        if (artistMatches > 0) {
          score += Math.min(45, artistMatches * 20);
        }
      }

      // Decrypted streamUrl bonus
      if (c.streamUrl) {
        score += 15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = c;
      }
    }

    // Require score >= 40 so random unrelated songs are never picked
    if (bestScore >= 40) {
      return bestCandidate;
    }
    return null;
  }

  /**
   * Helper: Resolves title+artist search queries to real audio streams with smart matching
   */
  async resolveAndSaveTracks(playlistName, rawTrackList, sourceUrl = '', onProgress = null) {
    const resolvedTracks = [];
    const limit = Math.min(rawTrackList.length, 50); // safety cap per import

    for (let i = 0; i < limit; i++) {
      const item = rawTrackList[i];
      if (typeof onProgress === 'function') {
        const pct = 30 + Math.round(((i + 1) / limit) * 65);
        onProgress(pct, `Matching song ${i + 1}/${limit}: "${item.title}"`);
      }

      let matchedTrack = null;
      try {
        // Step 1: Search with Title + Artist
        const query1 = item.artist ? `${item.title} ${item.artist}`.trim() : item.title.trim();
        let candidates = await window.MusicProvider.search(query1);
        matchedTrack = this.findBestMatch(item, candidates);

        // Step 2: If no confident match, retry with clean title alone
        if (!matchedTrack) {
          const cleanTitle = item.title.replace(/[\(\[\{].*?[\)\]\}]/g, '').replace(/[-–—].*$/, '').trim();
          candidates = await window.MusicProvider.search(cleanTitle);
          matchedTrack = this.findBestMatch(item, candidates);
        }

        if (matchedTrack) {
          if (item.artwork && !matchedTrack.artwork) matchedTrack.artwork = item.artwork;
          if (matchedTrack.artwork && window.getHighQualityArtwork) {
            matchedTrack.artwork = window.getHighQualityArtwork(matchedTrack.artwork);
          }
          resolvedTracks.push(matchedTrack);
        } else {
          // Never substitute an unrelated song! Store accurate track object
          const finalArt = (item.artwork && window.getHighQualityArtwork) ? window.getHighQualityArtwork(item.artwork) : (item.artwork || 'assets/icon.png');
          resolvedTracks.push({
            id: 'imp_' + Math.random().toString(36).substring(2, 9),
            title: item.title,
            artist: item.artist || 'Unknown Artist',
            album: playlistName,
            artwork: finalArt,
            durationFormatted: '3:30',
            streamUrl: null
          });
        }
      } catch (err) {
        const finalArt = (item.artwork && window.getHighQualityArtwork) ? window.getHighQualityArtwork(item.artwork) : (item.artwork || 'assets/icon.png');
        resolvedTracks.push({
          id: 'imp_' + Math.random().toString(36).substring(2, 9),
          title: item.title,
          artist: item.artist || 'Unknown Artist',
          album: playlistName,
          artwork: finalArt,
          durationFormatted: '3:30',
          streamUrl: null
        });
      }
    }

    if (window.Library && window.Library.savePlaylist) {
      return window.Library.savePlaylist(playlistName, resolvedTracks, sourceUrl);
    }

    return {
      id: 'pl_' + Date.now(),
      name: playlistName,
      title: playlistName,
      tracks: resolvedTracks,
      trackCount: resolvedTracks.length,
      artwork: resolvedTracks[0]?.artwork || 'assets/icon.png',
      sourceUrl,
      createdAt: Date.now()
    };
  }
}

window.PlaylistImporter = new PlaylistImporter();
