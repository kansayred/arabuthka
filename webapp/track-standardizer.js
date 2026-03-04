/**
 * track-standardizer.js — Модуль стандартизации названий треков и авторства
 * Правила ЛЖ (Лингвистический Журнал)
 *
 * Статья 1: Стандартизация названий
 * Статья 2: Стандартизация авторства
 *
 * Использование: window.TrackStandardizer.standardize(name, artist)
 */
(function() {
  'use strict';

  // ============================================================
  // Вспомогательные функции
  // ============================================================

  /**
   * Определяет преобладающий язык строки: 'cyrillic', 'latin' или 'mixed'
   */
  function detectScript(str) {
    if (!str) return 'latin';
    var cyrCount = 0;
    var latCount = 0;
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      // Кириллица: U+0400–U+04FF
      if (code >= 0x0400 && code <= 0x04FF) cyrCount++;
      // Латиница: A-Z, a-z
      else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) latCount++;
    }
    if (cyrCount === 0 && latCount === 0) return 'latin';
    if (cyrCount > latCount) return 'cyrillic';
    if (latCount > cyrCount) return 'latin';
    return 'mixed';
  }

  /**
   * Проверяет, является ли строка полностью в CAPS
   */
  function isAllCaps(str) {
    if (!str) return false;
    var letters = str.replace(/[^a-zA-Z\u0430-\u044f\u0410-\u042f\u0451\u0401]/g, '');
    if (letters.length === 0) return false;
    return letters === letters.toUpperCase() && letters.length >= 2;
  }

  /**
   * Проверяет, начинается ли строка с цифры
   */
  function startsWithDigit(str) {
    return /^\d/.test((str || '').trim());
  }

  /**
   * Определяет, является ли строка названием лейбла/студии
   * Эвристика: содержит Records, Music, Entertainment, Studio, Label
   */
  function isLabel(str) {
    return /\b(Records|Music|Entertainment|Studio|Label|Prod(?:uction)?s?)\b/i.test(str);
  }

  // ============================================================
  // Таблица транслитерации латиница → кириллица
  // Для распознавания кириллических слов, написанных латиницей
  // ============================================================
  var latinToCyrMap = {
    'a': '\u0430', 'b': '\u0431', 'v': '\u0432', 'g': '\u0433', 'd': '\u0434', 'e': '\u0435',
    'yo': '\u0451', 'zh': '\u0436', 'z': '\u0437', 'i': '\u0438', 'j': '\u0439',
    'k': '\u043a', 'l': '\u043b', 'm': '\u043c', 'n': '\u043d', 'o': '\u043e', 'p': '\u043f',
    'r': '\u0440', 's': '\u0441', 't': '\u0442', 'u': '\u0443', 'f': '\u0444',
    'kh': '\u0445', 'h': '\u0445', 'ts': '\u0446', 'ch': '\u0447', 'sh': '\u0448',
    'shch': '\u0449', 'y': '\u044b', 'yu': '\u044e', 'ya': '\u044f',
    'ey': '\u0435\u0439', 'iy': '\u0438\u0439', 'oy': '\u043e\u0439'
  };

  // Список распространённых кириллических слов, часто пишущихся латиницей
  var knownCyrillicWords = {
    'privet': '\u041f\u0440\u0438\u0432\u0435\u0442',
    'dorogaya': '\u0414\u043e\u0440\u043e\u0433\u0430\u044f',
    'solnyshko': '\u0421\u043e\u043b\u043d\u044b\u0448\u043a\u043e',
    'lyubov': '\u041b\u044e\u0431\u043e\u0432\u044c',
    'noch': '\u041d\u043e\u0447\u044c',
    'nebo': '\u041d\u0435\u0431\u043e',
    'gorod': '\u0413\u043e\u0440\u043e\u0434',
    'mechta': '\u041c\u0435\u0447\u0442\u0430',
    'serdtse': '\u0421\u0435\u0440\u0434\u0446\u0435',
    'vesna': '\u0412\u0435\u0441\u043d\u0430',
    'leto': '\u041b\u0435\u0442\u043e',
    'osen': '\u041e\u0441\u0435\u043d\u044c',
    'zima': '\u0417\u0438\u043c\u0430',
    'doroga': '\u0414\u043e\u0440\u043e\u0433\u0430',
    'ogon': '\u041e\u0433\u043e\u043d\u044c',
    'veter': '\u0412\u0435\u0442\u0435\u0440',
    'pesnya': '\u041f\u0435\u0441\u043d\u044f',
    'muzyka': '\u041c\u0443\u0437\u044b\u043a\u0430',
    'tanets': '\u0422\u0430\u043d\u0435\u0446',
    'devochka': '\u0414\u0435\u0432\u043e\u0447\u043a\u0430',
    'malchik': '\u041c\u0430\u043b\u044c\u0447\u0438\u043a',
    'mama': '\u041c\u0430\u043c\u0430',
    'papa': '\u041f\u0430\u043f\u0430',
    'dom': '\u0414\u043e\u043c',
    'mir': '\u041c\u0438\u0440',
    'den': '\u0414\u0435\u043d\u044c',
    'drug': '\u0414\u0440\u0443\u0433',
    'dusha': '\u0414\u0443\u0448\u0430',
    'zhizn': '\u0416\u0438\u0437\u043d\u044c',
    'schastye': '\u0421\u0447\u0430\u0441\u0442\u044c\u0435',
    'radost': '\u0420\u0430\u0434\u043e\u0441\u0442\u044c',
    'pechal': '\u041f\u0435\u0447\u0430\u043b\u044c',
    'nadezhda': '\u041d\u0430\u0434\u0435\u0436\u0434\u0430',
    'svoboda': '\u0421\u0432\u043e\u0431\u043e\u0434\u0430',
    'mechty': '\u041c\u0435\u0447\u0442\u044b',
    'zvyozdy': '\u0417\u0432\u0451\u0437\u0434\u044b',
    'luna': '\u041b\u0443\u043d\u0430',
    'solntse': '\u0421\u043e\u043b\u043d\u0446\u0435',
    'reka': '\u0420\u0435\u043a\u0430',
    'more': '\u041c\u043e\u0440\u0435',
    'gory': '\u0413\u043e\u0440\u044b',
    'tishina': '\u0422\u0438\u0448\u0438\u043d\u0430',
    'molchanie': '\u041c\u043e\u043b\u0447\u0430\u043d\u0438\u0435'
  };

  /**
   * Пытается конвертировать латинское слово в кириллицу,
   * если оно является известным кириллическим словом (Статья 1a.1)
   */
  function tryLatinToCyrillic(word) {
    if (!word) return null;
    var lower = word.toLowerCase();
    if (knownCyrillicWords[lower]) {
      return knownCyrillicWords[lower];
    }
    return null;
  }

  // ============================================================
  // Статья 1: Стандартизация названий
  // ============================================================

  /**
   * Удаляет запрещённые знаки препинания (!, ;, :, точки в середине)
   * Допускаются: запятые и вопросительные знаки (Статья 1d)
   */
  function removeForbiddenPunctuation(str) {
    // Убираем !, ;, :
    str = str.replace(/[!;:]/g, '');
    // Убираем точки в середине строки
    str = str.replace(/\.(?=.)/g, '');
    // Убираем точку в конце (названия треков без точки)
    str = str.replace(/\.$/, '');
    return str;
  }

  /**
   * Кириллическое оформление: первое слово с заглавной, остальные строчные (Статья 1c)
   */
  function capitalizeCyrillic(str) {
    if (!str) return str;
    var words = str.split(/\s+/);
    return words.map(function(w, i) {
      if (i === 0) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
      return w.toLowerCase();
    }).join(' ');
  }

  /**
   * Латинское оформление: Title Case — каждое слово с заглавной (Статья 1c)
   */
  function titleCaseLatin(str) {
    if (!str) return str;
    var smallWords = ['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for',
                      'yet', 'so', 'at', 'by', 'in', 'of', 'on', 'to', 'up',
                      'is', 'it', 'as', 'if', 'no', 'not', 'vs'];
    var words = str.split(/\s+/);
    return words.map(function(w, i) {
      var lower = w.toLowerCase();
      if (i === 0 || i === words.length - 1) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
      if (smallWords.indexOf(lower) !== -1) {
        return lower;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }

  /**
   * Главная функция стандартизации названия трека
   */
  function standardizeName(name) {
    if (!name) return name || '';

    // 1. Trim
    var result = name.trim();

    // 2. Удалить запрещённые знаки
    result = removeForbiddenPunctuation(result);

    // 3. Убрать множественные пробелы
    result = result.replace(/\s{2,}/g, ' ').trim();

    // 4. Попытка конвертации латинских слов в кириллицу (Статья 1a.1)
    var words = result.split(/\s+/);
    var converted = words.map(function(w) {
      var cyr = tryLatinToCyrillic(w);
      return cyr || w;
    });
    result = converted.join(' ');

    // 5. Определить язык по преобладающим символам
    var script = detectScript(result);

    // 6. Применить правила регистра
    if (script === 'cyrillic') {
      result = capitalizeCyrillic(result);
    } else {
      result = titleCaseLatin(result);
    }

    return result;
  }

  // ============================================================
  // Статья 2: Стандартизация авторства
  // ============================================================

  var SEPARATORS_REGEX = /\s*(?:,\s*|\s+ft\.\s+|\s+feat\.\s+|\s+prod\.\s+|\s+&\s+)/i;
  var SEPARATOR_CAPTURE = /(\s*(?:,|ft\.|feat\.|prod\.|&)\s*)/i;

  /**
   * Извлекает информацию об авторе для сортировки
   */
  function getArtistInfo(artist) {
    var trimmed = artist.trim();
    return {
      name: trimmed,
      script: detectScript(trimmed),
      isCaps: isAllCaps(trimmed),
      startsDigit: startsWithDigit(trimmed),
      isLabel: isLabel(trimmed)
    };
  }

  /**
   * Вычисляет приоритет сортировки (меньше = выше)
   * Порядок: лейблы > цифры спереди > капс > латиница > кириллица > алфавит
   */
  function getSortPriority(info) {
    var priority = 0;

    // Лейблы/студии — первые (Статья 2g)
    if (info.isLabel) priority -= 10000;

    // Цифры спереди — вторые (Статья 2c)
    if (info.startsDigit) priority -= 5000;

    // Капс — выше (Статья 2b)
    if (info.isCaps) priority -= 1000;

    // Латиница перед кириллицей (Статья 2a)
    if (info.script === 'latin') {
      priority -= 500;
    } else if (info.script === 'cyrillic') {
      priority -= 100;
    }

    return priority;
  }

  /**
   * Парсит строку авторства, разделяя по разным типам разделителей
   * Возвращает массив объектов { name, separator }
   */
  function parseArtists(artistStr) {
    if (!artistStr) return [];

    var parts = artistStr.split(SEPARATOR_CAPTURE);
    var artists = [];
    var currentSep = ', ';

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part) continue;

      if (/^(,|ft\.|feat\.|prod\.|&)$/i.test(part)) {
        var lower = part.toLowerCase();
        if (lower === 'feat.' || lower === 'ft.') currentSep = ' ft. ';
        else if (lower === 'prod.') currentSep = ' prod. ';
        else if (lower === '&') currentSep = ' & ';
        else currentSep = ', ';
        continue;
      }

      artists.push({
        name: part,
        separator: currentSep
      });
      currentSep = ', ';
    }

    return artists;
  }

  /**
   * Проверяет наличие ИИ-маркеров в строке авторства (Статья 2h)
   */
  function checkAiGenerated(artistStr) {
    if (!artistStr) return { isAi: false, original: artistStr };

    var aiPatterns = [
      /\b(?:AI|\u0418\u0418|artificial intelligence|\u0438\u0441\u043a\u0443\u0441\u0441\u0442\u0432\u0435\u043d\u043d\w+ \u0438\u043d\u0442\u0435\u043b\u043b\u0435\u043a\u0442)\b/i,
      /\b(?:suno|udio|mubert|aiva|soundraw|boomy)\b/i,
      /\bgenerat(?:ed|ion)\b/i,
      /\b\u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\w+/i
    ];

    for (var i = 0; i < aiPatterns.length; i++) {
      if (aiPatterns[i].test(artistStr)) {
        return { isAi: true, original: artistStr };
      }
    }
    return { isAi: false, original: artistStr };
  }

  /**
   * Главная функция стандартизации авторства
   */
  function standardizeArtist(artistStr) {
    if (!artistStr) return artistStr || '';

    var trimmed = artistStr.trim();

    // Проверка ИИ-генерации (Статья 2h)
    var aiCheck = checkAiGenerated(trimmed);
    if (aiCheck.isAi) {
      var hasHumanCoauthor = parseArtists(trimmed).some(function(a) {
        return !checkAiGenerated(a.name).isAi;
      });
      if (!hasHumanCoauthor) {
        return '\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u043e \u0418\u0418';
      }
      var cleanParts = parseArtists(trimmed).filter(function(a) {
        return !checkAiGenerated(a.name).isAi;
      });
      var humanNames = cleanParts.map(function(a) { return a.name; });
      return humanNames.join(', ') + ', \u0441\u043e\u0437\u0434\u0430\u043d\u043e \u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e \u0418\u0418';
    }

    // 1. Парсим авторов
    var parsed = parseArtists(trimmed);
    if (parsed.length === 0) return trimmed;

    // 2. Группируем по типу разделителя
    var mainArtists = [];
    var featArtists = [];
    var prodArtists = [];
    var mashupArtists = [];

    parsed.forEach(function(p) {
      if (p.separator === ' ft. ') featArtists.push(p.name);
      else if (p.separator === ' prod. ') prodArtists.push(p.name);
      else if (p.separator === ' & ') mashupArtists.push(p.name);
      else mainArtists.push(p.name);
    });

    if (mainArtists.length === 0 && featArtists.length > 0) {
      mainArtists.push(featArtists.shift());
    }

    // 3. Сортировка каждой группы
    function sortGroup(group) {
      return group.slice().sort(function(a, b) {
        var infoA = getArtistInfo(a);
        var infoB = getArtistInfo(b);
        var prioA = getSortPriority(infoA);
        var prioB = getSortPriority(infoB);
        if (prioA !== prioB) return prioA - prioB;
        return a.localeCompare(b, 'ru');
      });
    }

    mainArtists = sortGroup(mainArtists);
    featArtists = sortGroup(featArtists);
    prodArtists = sortGroup(prodArtists);
    mashupArtists = sortGroup(mashupArtists);

    // 4. Пересобираем строку с правильными разделителями (Статья 2e)
    var result = mainArtists.join(', ');

    if (mashupArtists.length > 0) {
      if (result) result += ' & ';
      result += mashupArtists.join(' & ');
    }

    if (featArtists.length > 0) {
      if (result) result += ' ft. ';
      result += featArtists.join(', ');
    }

    if (prodArtists.length > 0) {
      if (result) result += ' prod. ';
      result += prodArtists.join(', ');
    }

    return result;
  }

  // ============================================================
  // Публичное API
  // ============================================================

  window.TrackStandardizer = {
    /**
     * Стандартизирует название и авторство трека
     * @param {string} name — Название трека
     * @param {string} artist — Строка авторства
     * @returns {{ name: string, artist: string }}
     */
    standardize: function(name, artist) {
      return {
        name: standardizeName(name),
        artist: standardizeArtist(artist)
      };
    },

    /**
     * Стандартизирует только название
     */
    standardizeName: standardizeName,

    /**
     * Стандартизирует только авторство
     */
    standardizeArtist: standardizeArtist,

    /**
     * Определяет преобладающий скрипт строки
     */
    detectScript: detectScript
  };
})();
