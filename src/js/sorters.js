/**
 * Sorters — 18 shuffle and sorting algorithms for Spotify playlists
 */
const Sorters = (() => {
  'use strict';

  // Fisher-Yates shuffle
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Accent-insensitive lowercase normalization for sorting and grouping
  function normalize(str) {
    return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function compareStrings(a, b) {
    return normalize(a).localeCompare(normalize(b));
  }

  function parseDateToNumber(dateStr) {
    if (!dateStr) return 0;
    // Handles "YYYY", "YYYY-MM", or "YYYY-MM-DD"
    const iso = dateStr.length === 4 ? `${dateStr}-01-01`
      : dateStr.length === 7 ? `${dateStr}-01`
      : dateStr;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : 0;
  }

  function parseTimestamp(dateStr) {
    if (!dateStr) return 0;
    const ms = Date.parse(dateStr);
    return Number.isFinite(ms) ? ms : 0;
  }

  // Prototype-safe grouping helper using Map
  function groupBy(arr, keyFn) {
    const groups = new Map();
    for (const item of arr) {
      const key = keyFn(item);
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      list.push(item);
    }
    return groups;
  }

  // ============= ALGORITHMS =============

  /** Full Shuffle */
  function random(tracks) {
    return shuffle(tracks);
  }

  /** Shuffle by Album: randomize album order while preserving track order inside each album */
  function randomByAlbum(tracks) {
    const groups = groupBy(tracks, t => t.album.id || t.album.name || t.uri);
    const shuffledKeys = shuffle(Array.from(groups.keys()));
    return shuffledKeys.flatMap(key => groups.get(key));
  }

  /** Shuffle by Artist: randomize artist order while keeping each artist's tracks together */
  function randomByArtist(tracks) {
    const groups = groupBy(tracks, t => t.artists[0]?.id || t.artistName || t.uri);
    const shuffledKeys = shuffle(Array.from(groups.keys()));
    return shuffledKeys.flatMap(key => groups.get(key));
  }

  /** Shuffle by Name: group by starting letter and shuffle both groups and tracks within them */
  function randomByName(tracks) {
    const groups = groupBy(tracks, t => {
      const first = normalize(t.name).trim().charAt(0);
      return /\p{L}/u.test(first) ? first : '#';
    });
    const shuffledKeys = shuffle(Array.from(groups.keys()));
    return shuffledKeys.flatMap(key => shuffle(groups.get(key)));
  }

  /** Track Name A -> Z */
  function nameAsc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(a.name, b.name));
  }

  /** Track Name Z -> A */
  function nameDesc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(b.name, a.name));
  }

  /** Artist A -> Z */
  function artistAsc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(a.artistName, b.artistName));
  }

  /** Artist Z -> A */
  function artistDesc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(b.artistName, a.artistName));
  }

  /** Album A -> Z */
  function albumAsc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(a.album.name, b.album.name));
  }

  /** Album Z -> A */
  function albumDesc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(b.album.name, a.album.name));
  }

  /** Release Date — Newest first */
  function dateNewest(tracks) {
    return [...tracks].sort((a, b) => parseDateToNumber(b.album.releaseDate) - parseDateToNumber(a.album.releaseDate));
  }

  /** Release Date — Oldest first */
  function dateOldest(tracks) {
    return [...tracks].sort((a, b) => parseDateToNumber(a.album.releaseDate) - parseDateToNumber(b.album.releaseDate));
  }

  /** Duration — Longest first */
  function durationLongest(tracks) {
    return [...tracks].sort((a, b) => b.duration - a.duration);
  }

  /** Duration — Shortest first */
  function durationShortest(tracks) {
    return [...tracks].sort((a, b) => a.duration - b.duration);
  }

  /** Popularity — Most popular first */
  function popularityDesc(tracks) {
    return [...tracks].sort((a, b) => b.popularity - a.popularity);
  }

  /** Popularity — Least popular first */
  function popularityAsc(tracks) {
    return [...tracks].sort((a, b) => a.popularity - b.popularity);
  }

  /** Date Added — Newest first */
  function addedNewest(tracks) {
    return [...tracks].sort((a, b) => parseTimestamp(b.addedAt) - parseTimestamp(a.addedAt));
  }

  /** Date Added — Oldest first */
  function addedOldest(tracks) {
    return [...tracks].sort((a, b) => parseTimestamp(a.addedAt) - parseTimestamp(b.addedAt));
  }

  const SORT_MAP = {
    'random': { fn: random, label: 'Full Shuffle' },
    'random-album': { fn: randomByAlbum, label: 'Shuffle by Album' },
    'random-artist': { fn: randomByArtist, label: 'Shuffle by Artist' },
    'random-name': { fn: randomByName, label: 'Shuffle by Name' },
    'name-asc': { fn: nameAsc, label: 'Name A → Z' },
    'name-desc': { fn: nameDesc, label: 'Name Z → A' },
    'artist-asc': { fn: artistAsc, label: 'Artist A → Z' },
    'artist-desc': { fn: artistDesc, label: 'Artist Z → A' },
    'album-asc': { fn: albumAsc, label: 'Album A → Z' },
    'album-desc': { fn: albumDesc, label: 'Album Z → A' },
    'date-newest': { fn: dateNewest, label: 'Release — Newest' },
    'date-oldest': { fn: dateOldest, label: 'Release — Oldest' },
    'duration-longest': { fn: durationLongest, label: 'Duration — Longest' },
    'duration-shortest': { fn: durationShortest, label: 'Duration — Shortest' },
    'popularity-desc': { fn: popularityDesc, label: 'Popularity — Most Popular' },
    'popularity-asc': { fn: popularityAsc, label: 'Popularity — Least Popular' },
    'added-newest': { fn: addedNewest, label: 'Date Added — Newest' },
    'added-oldest': { fn: addedOldest, label: 'Date Added — Oldest' },
  };

  function sort(type, tracks) {
    const sorter = SORT_MAP[type];
    if (!sorter) throw new Error(`Unknown sort type: ${type}`);
    return sorter.fn(tracks);
  }

  function getLabel(type) {
    if (typeof I18n !== 'undefined') {
      return I18n.t(`sort_${type}`);
    }
    return SORT_MAP[type]?.label || type;
  }

  return { sort, getLabel, SORT_MAP };
})();
