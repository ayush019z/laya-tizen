/**
 * Laya TV - Apple-Style Word-by-Word Synchronized Lyrics Engine
 * Inspired by binimum/am-lyrics & LRCLIB Integration
 */

class LyricsService {
  constructor() {
    this.apiBase = 'https://lrclib.net/api';
    this.cache = new Map();
  }

  /**
   * Fetch word-synced or line-synced lyrics for a track from LRCLIB
   */
  async fetchLyrics(track) {
    if (!track) return null;

    const cacheKey = `${track.title}_${track.artist}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 1. If track already has embedded lyrics (like curated tracks)
    if (track.lyrics && track.lyrics.length > 0) {
      const parsed = this.normalizeLyrics(track.lyrics);
      this.cache.set(cacheKey, parsed);
      return parsed;
    }

    // 2. Query LRCLIB via precise get with track duration matching
    const cleanTitle = (track.title || '')
      .replace(/\(From.*?\)/gi, '')
      .replace(/\[From.*?\]/gi, '')
      .replace(/\(Original.*?\)/gi, '')
      .replace(/ - Soundtrack.*/gi, '')
      .trim();
    const firstArtist = (track.artist || '').split(/[,-]/)[0].trim();
    const targetDuration = track.duration && track.duration > 20 ? Math.round(track.duration) : 0;
    const durParam = targetDuration > 0 ? `&duration=${targetDuration}` : '';

    try {
      const url = `${this.apiBase}/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(firstArtist)}${durParam}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics) {
          const parsed = this.parseLRC(data.syncedLyrics);
          this.cache.set(cacheKey, parsed);
          return parsed;
        } else if (data.plainLyrics) {
          const parsed = this.parsePlainLyrics(data.plainLyrics, track.duration || 240);
          this.cache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (e) {}

    // Helper to pick candidate with closest audio duration match (prevents music video / remix offset)
    const findClosestDurationMatch = (list) => {
      if (!Array.isArray(list) || list.length === 0) return null;
      const synced = list.filter(x => x.syncedLyrics);
      const candidates = synced.length > 0 ? synced : list;
      if (!targetDuration) return candidates[0];
      return candidates.slice().sort((a, b) => {
        const diffA = Math.abs((a.duration || 0) - targetDuration);
        const diffB = Math.abs((b.duration || 0) - targetDuration);
        return diffA - diffB;
      })[0];
    };

    // 3. Query LRCLIB Search endpoint (handles variations like "Ishq Hai", "Kesariya", etc.)
    try {
      const searchUrl = `${this.apiBase}/search?q=${encodeURIComponent(cleanTitle + ' ' + firstArtist)}`;
      const sRes = await fetch(searchUrl);
      if (sRes.ok) {
        const sData = await sRes.json();
        const match = findClosestDurationMatch(sData);
        if (match?.syncedLyrics) {
          const parsed = this.parseLRC(match.syncedLyrics);
          this.cache.set(cacheKey, parsed);
          return parsed;
        } else if (match?.plainLyrics) {
          const parsed = this.parsePlainLyrics(match.plainLyrics, track.duration || 240);
          this.cache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (e) {}

    // 4. Try title-only search on LRCLIB as a broader fallback (e.g. for "Ishq Hai")
    try {
      const titleOnlyUrl = `${this.apiBase}/search?q=${encodeURIComponent(cleanTitle)}`;
      const tRes = await fetch(titleOnlyUrl);
      if (tRes.ok) {
        const tData = await tRes.json();
        const match = findClosestDurationMatch(tData);
        if (match?.syncedLyrics) {
          const parsed = this.parseLRC(match.syncedLyrics);
          this.cache.set(cacheKey, parsed);
          return parsed;
        } else if (match?.plainLyrics) {
          const parsed = this.parsePlainLyrics(match.plainLyrics, track.duration || 240);
          this.cache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (e) {}

    // 5. Clean contextual fallback (Never show Espresso or fake lyrics on other songs!)
    const fallback = [
      {
        time: 0,
        text: `♪ ${track.title} ♪`,
        words: [{ text: "♪", time: 0 }, { text: track.title, time: 0.8 }, { text: "♪", time: 1.6 }]
      },
      {
        time: 5,
        text: `Performed by ${track.artist}`,
        words: [{ text: "Performed", time: 5.0 }, { text: "by", time: 5.5 }, { text: track.artist, time: 6.0 }]
      },
      {
        time: 12,
        text: "Playing in High-Fidelity Audio on Laya TV",
        words: [{ text: "Playing", time: 12.0 }, { text: "in", time: 12.6 }, { text: "High-Fidelity", time: 13.2 }, { text: "Audio", time: 13.8 }]
      }
    ];
    this.cache.set(cacheKey, fallback);
    return fallback;
  }

  parsePlainLyrics(plainText, totalDuration) {
    if (!plainText) return [];
    const rawLines = plainText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) return [];

    const interval = Math.max(3, Math.min(8, (totalDuration - 10) / rawLines.length));
    return rawLines.map((line, idx) => ({
      time: Math.round((idx * interval) * 10) / 10,
      text: line,
      words: line.split(' ').map((w, wIdx) => ({
        text: w,
        time: Math.round(((idx * interval) + (wIdx * 0.4)) * 10) / 10
      }))
    }));
  }

  /**
   * Parse Enhanced LRC with word-level timestamps e.g.
   * [00:12.30] <00:12.30> That's <00:12.75> that <00:13.10> me <00:13.60> espresso
   * or standard [00:12.30] Line text
   */
  parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const result = [];

    // Parse [offset: +/-millis]
    let lrcOffset = 0;
    const offsetMatch = lrcText.match(/\[offset:\s*([+-]?\d+)\]/i);
    if (offsetMatch) {
      lrcOffset = parseInt(offsetMatch[1], 10) / 1000;
    }

    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    const wordRegex = /<(\d{2}):(\d{2})\.(\d{2,3})>([^<]*)/g;

    for (const rawLine of lines) {
      const match = rawLine.match(timeRegex);
      if (!match) continue;

      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = parseInt(match[3].padEnd(3, '0'), 10);
      const startTime = Math.max(0, (min * 60 + sec + ms / 1000) + lrcOffset);
      const text = match[4].trim();

      // Check for word-level timestamps
      const words = [];
      let wordMatch;
      let hasWordTimestamps = false;

      while ((wordMatch = wordRegex.exec(text)) !== null) {
        hasWordTimestamps = true;
        const wMin = parseInt(wordMatch[1], 10);
        const wSec = parseInt(wordMatch[2], 10);
        const wMs = parseInt(wordMatch[3].padEnd(3, '0'), 10);
        const wTime = Math.max(0, (wMin * 60 + wSec + wMs / 1000) + lrcOffset);
        const wordText = wordMatch[4].trim();
        if (wordText) {
          words.push({ text: wordText, time: wTime });
        }
      }

      // If no word timestamps, split plain text into words and interpolate
      if (!hasWordTimestamps) {
        const plainWords = text.replace(/<[^>]*>/g, '').trim().split(/\s+/);
        plainWords.forEach((pw, idx) => {
          words.push({
            text: pw,
            time: Math.max(0, startTime + idx * 0.35)
          });
        });
      }

      result.push({
        time: startTime,
        text: text.replace(/<[^>]*>/g, '').trim(),
        words: words
      });
    }

    return result.sort((a, b) => a.time - b.time);
  }

  normalizeLyrics(lyricsArray) {
    return lyricsArray.map(line => {
      const words = (line.text || '').split(/\s+/).map((w, idx) => ({
        text: w,
        time: line.time + idx * 0.35
      }));
      return {
        time: line.time,
        text: line.text,
        words: words
      };
    });
  }
}

window.LyricsService = new LyricsService();
