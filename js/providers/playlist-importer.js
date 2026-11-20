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
  async importFromUrl(urlOrText) {
    if (!urlOrText || typeof urlOrText !== 'string') {
      throw new Error('Please provide a valid playlist link or song list');
    }

    const input = urlOrText.trim();
    this.isImporting = true;

    try {
      if (input.includes('spotify.com')) {
        return await this.importSpotify(input);
      } else if (input.includes('jiosaavn.com') || input.includes('saavn.com')) {
        return await this.importJioSaavn(input);
      } else if (input.includes('music.apple.com')) {
        return await this.importAppleMusic(input);
      } else if (input.includes('youtube.com') || input.includes('youtu.be')) {
        return await this.importYouTube(input);
      } else {
        // Assume text list of tracks (e.g. "Tum Hi Ho\nKesariya")
        return await this.importFromRawText(input);
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
                artwork: s.image && s.image[2] ? s.image[2].link : ''
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
   * 3. Apple Music Playlist Importer
   */
  async importAppleMusic(url) {
    let name = 'Apple Music Playlist';
    const rawTrackList = [];

    // Apple Music embed page has clean structured data
    const embedUrl = url.replace('music.apple.com', 'embed.music.apple.com');
    const res = await fetch(embedUrl);
    if (!res.ok) {
      throw new Error('Could not access Apple Music playlist embed.');
    }

    const html = await res.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) name = titleMatch[1].replace(/on Apple Music/gi, '').trim();

    const regex = /class="track-title"[^>]*>([^<]+)<\/div>[\s\S]*?class="track-artist"[^>]*>([^<]+)<\/div>/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
      rawTrackList.push({ title: m[1].trim(), artist: m[2].trim() });
    }

    if (rawTrackList.length === 0) {
      throw new Error('Could not parse Apple Music tracks. Ensure link is public.');
    }

    return await this.resolveAndSaveTracks(name, rawTrackList, url);
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
   * Helper: Resolves title+artist search queries to real YouTube Music tracks with audio streams
   */
  async resolveAndSaveTracks(playlistName, rawTrackList, sourceUrl = '') {
    const resolvedTracks = [];
    const limit = Math.min(rawTrackList.length, 50); // safety cap per import

    for (let i = 0; i < limit; i++) {
      const item = rawTrackList[i];
      const query = item.artist ? `${item.title} ${item.artist}` : item.title;

      try {
        const results = await window.MusicProvider.search(query);
        if (results && results.length > 0) {
          resolvedTracks.push(results[0]);
        } else {
          // Add basic track object fallback
          resolvedTracks.push({
            id: 'imp_' + Math.random().toString(36).substring(2, 9),
            title: item.title,
            artist: item.artist || 'Unknown Artist',
            album: playlistName,
            artwork: item.artwork || 'assets/icon.png',
            durationFormatted: '3:30'
          });
        }
      } catch (err) {
        resolvedTracks.push({
          id: 'imp_' + Math.random().toString(36).substring(2, 9),
          title: item.title,
          artist: item.artist || 'Unknown Artist',
          album: playlistName,
          artwork: item.artwork || 'assets/icon.png',
          durationFormatted: '3:30'
        });
      }
    }

    return window.Library.savePlaylist(playlistName, resolvedTracks, sourceUrl);
  }
}

window.PlaylistImporter = new PlaylistImporter();
