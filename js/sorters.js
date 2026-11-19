/**
 * Sorters — Algoritmos de ordenação para a playlist
 */
const Sorters = (() => {

  // Fisher-Yates shuffle
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Comparador normalizado (remove acentos para comparação)
  function normalize(str) {
    return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function compareStrings(a, b) {
    return normalize(a).localeCompare(normalize(b));
  }

  function parseDateToNumber(dateStr) {
    if (!dateStr) return 0;
    // Pode ser "2023", "2023-05", ou "2023-05-15"
    return new Date(dateStr.length === 4 ? `${dateStr}-01-01` : dateStr.length === 7 ? `${dateStr}-01` : dateStr).getTime() || 0;
  }

  // ============= ALGORITMOS =============

  /** Aleatório total */
  function random(tracks) {
    return shuffle(tracks);
  }

  /** Aleatório por álbum: agrupa por álbum, embaralha a ordem dos álbuns, mantém a ordem das faixas no álbum */
  function randomByAlbum(tracks) {
    const groups = groupBy(tracks, t => t.album.id);
    const shuffledKeys = shuffle(Object.keys(groups));
    return shuffledKeys.flatMap(key => groups[key]);
  }

  /** Aleatório por artista: agrupa por artista principal, embaralha a ordem dos artistas */
  function randomByArtist(tracks) {
    const groups = groupBy(tracks, t => t.artists[0]?.id || 'unknown');
    const shuffledKeys = shuffle(Object.keys(groups));
    return shuffledKeys.flatMap(key => groups[key]);
  }

  /** Aleatório por nome: agrupa pela letra inicial, embaralha a ordem dos grupos, e embaralha dentro de cada grupo */
  function randomByName(tracks) {
    const groups = groupBy(tracks, t => {
      const first = normalize(t.name).charAt(0);
      return /[a-z]/.test(first) ? first : '#';
    });
    const shuffledKeys = shuffle(Object.keys(groups));
    return shuffledKeys.flatMap(key => shuffle(groups[key]));
  }

  /** Por nome A-Z */
  function nameAsc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(a.name, b.name));
  }

  /** Por nome Z-A */
  function nameDesc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(b.name, a.name));
  }

  /** Por artista A-Z */
  function artistAsc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(a.artistName, b.artistName));
  }

  /** Por artista Z-A */
  function artistDesc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(b.artistName, a.artistName));
  }

  /** Por álbum A-Z */
  function albumAsc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(a.album.name, b.album.name));
  }

  /** Por álbum Z-A */
  function albumDesc(tracks) {
    return [...tracks].sort((a, b) => compareStrings(b.album.name, a.album.name));
  }

  /** Por data de lançamento — mais recente primeiro */
  function dateNewest(tracks) {
    return [...tracks].sort((a, b) => parseDateToNumber(b.album.releaseDate) - parseDateToNumber(a.album.releaseDate));
  }

  /** Por data de lançamento — mais antigo primeiro */
  function dateOldest(tracks) {
    return [...tracks].sort((a, b) => parseDateToNumber(a.album.releaseDate) - parseDateToNumber(b.album.releaseDate));
  }

  /** Por duração — mais longa primeiro */
  function durationLongest(tracks) {
    return [...tracks].sort((a, b) => b.duration - a.duration);
  }

  /** Por duração — mais curta primeiro */
  function durationShortest(tracks) {
    return [...tracks].sort((a, b) => a.duration - b.duration);
  }

  /** Por popularidade — mais popular primeiro */
  function popularityDesc(tracks) {
    return [...tracks].sort((a, b) => b.popularity - a.popularity);
  }

  /** Por popularidade — menos popular primeiro */
  function popularityAsc(tracks) {
    return [...tracks].sort((a, b) => a.popularity - b.popularity);
  }

  /** Por data de adição — mais recente primeiro */
  function addedNewest(tracks) {
    return [...tracks].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }

  /** Por data de adição — mais antigo primeiro */
  function addedOldest(tracks) {
    return [...tracks].sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
  }

  // Helper: agrupar por chave
  function groupBy(arr, keyFn) {
    const groups = {};
    for (const item of arr) {
      const key = keyFn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }

  // Mapeamento nome → função
  const SORT_MAP = {
    'random': { fn: random, label: 'Aleatório Total' },
    'random-album': { fn: randomByAlbum, label: 'Aleatório por Álbum' },
    'random-artist': { fn: randomByArtist, label: 'Aleatório por Artista' },
    'random-name': { fn: randomByName, label: 'Aleatório por Nome' },
    'name-asc': { fn: nameAsc, label: 'Nome A → Z' },
    'name-desc': { fn: nameDesc, label: 'Nome Z → A' },
    'artist-asc': { fn: artistAsc, label: 'Artista A → Z' },
    'artist-desc': { fn: artistDesc, label: 'Artista Z → A' },
    'album-asc': { fn: albumAsc, label: 'Álbum A → Z' },
    'album-desc': { fn: albumDesc, label: 'Álbum Z → A' },
    'date-newest': { fn: dateNewest, label: 'Lançamento — Mais Recente' },
    'date-oldest': { fn: dateOldest, label: 'Lançamento — Mais Antigo' },
    'duration-longest': { fn: durationLongest, label: 'Duração — Mais Longa' },
    'duration-shortest': { fn: durationShortest, label: 'Duração — Mais Curta' },
    'popularity-desc': { fn: popularityDesc, label: 'Popularidade — Mais Popular' },
    'popularity-asc': { fn: popularityAsc, label: 'Popularidade — Menos Popular' },
    'added-newest': { fn: addedNewest, label: 'Adição — Mais Recente' },
    'added-oldest': { fn: addedOldest, label: 'Adição — Mais Antigo' },
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
