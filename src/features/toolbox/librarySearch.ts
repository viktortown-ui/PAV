import { ComponentDefinition } from '../../domain/schemas/types';

export type ToolboxSearchScope = 'global' | 'family';

export type MatchReason =
  | 'title'
  | 'shortName'
  | 'alias'
  | 'tag'
  | 'subtype'
  | 'family'
  | 'libraryTag'
  | 'context'
  | 'compatibility'
  | 'metadata';

export interface SearchMatchDetail {
  reason: MatchReason;
  value: string;
}

export interface SearchResult {
  item: ComponentDefinition;
  score: number;
  matchDetails: SearchMatchDetail[];
}

const reasonWeight: Record<MatchReason, number> = {
  title: 120,
  shortName: 110,
  alias: 100,
  tag: 90,
  subtype: 80,
  family: 70,
  libraryTag: 65,
  context: 55,
  compatibility: 50,
  metadata: 40,
};

const normalize = (value: string) => value.toLowerCase().replace(/ё/g, 'е').trim();
const tokenize = (value: string) => normalize(value).split(/\s+/).filter(Boolean);

const pushMatches = (bucket: SearchMatchDetail[], reason: MatchReason, values: string[], queryTokens: string[], fullQuery: string) => {
  values.forEach((value) => {
    const normalizedValue = normalize(value);
    if (!normalizedValue) return;
    const matchesFull = fullQuery.length > 0 && normalizedValue.includes(fullQuery);
    const matchesTokens = queryTokens.length > 0 && queryTokens.every((token) => normalizedValue.includes(token));
    if (matchesFull || matchesTokens) bucket.push({ reason, value });
  });
};

const computeScore = (matches: SearchMatchDetail[], fullQuery: string) => matches.reduce((total, match) => {
  const exactBonus = normalize(match.value) === fullQuery ? 25 : normalize(match.value).startsWith(fullQuery) ? 10 : 0;
  return total + reasonWeight[match.reason] + exactBonus;
}, 0);

export const getSearchableValues = (item: ComponentDefinition): Record<MatchReason, string[]> => ({
  title: [item.label, item.description, item.ruDescriptionShort],
  shortName: [item.shortName, item.technicalPrefix],
  alias: [...item.aliases, ...item.synonyms],
  tag: item.tags,
  subtype: [item.subtypeLabel, item.subtype],
  family: [item.familyLabel, item.family],
  libraryTag: item.libraryTags,
  context: item.insertionContextHints,
  compatibility: item.compatibilityHints,
  metadata: item.searchMetadata,
});

export const searchLibraryItems = (items: ComponentDefinition[], query: string): SearchResult[] => {
  const fullQuery = normalize(query);
  if (!fullQuery) return items.map((item) => ({ item, score: 0, matchDetails: [] }));
  const queryTokens = tokenize(query);

  return items
    .map((item) => {
      const matches: SearchMatchDetail[] = [];
      const values = getSearchableValues(item);
      (Object.entries(values) as Array<[MatchReason, string[]]>).forEach(([reason, entries]) => {
        pushMatches(matches, reason, entries, queryTokens, fullQuery);
      });
      return { item, matchDetails: matches, score: computeScore(matches, fullQuery) };
    })
    .filter((entry) => entry.matchDetails.length > 0)
    .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label, 'ru'));
};

export const groupSearchResultsByFamily = (results: SearchResult[]) => {
  const grouped = new Map<string, { familyLabel: string; family: ComponentDefinition['family']; results: SearchResult[] }>();
  results.forEach((result) => {
    const existing = grouped.get(result.item.family);
    if (existing) existing.results.push(result);
    else grouped.set(result.item.family, { family: result.item.family, familyLabel: result.item.familyLabel, results: [result] });
  });
  return [...grouped.values()];
};

export const summarizeMatchReason = (match: SearchMatchDetail | undefined) => {
  if (!match) return 'Найдено по описанию';
  switch (match.reason) {
    case 'title': return `Название: ${match.value}`;
    case 'shortName': return `Короткое имя: ${match.value}`;
    case 'alias': return `Синоним: ${match.value}`;
    case 'tag': return `Технический тег: ${match.value}`;
    case 'subtype': return `Подтип: ${match.value}`;
    case 'family': return `Семейство: ${match.value}`;
    case 'libraryTag': return `Тег библиотеки: ${match.value}`;
    case 'context': return `Контекст вставки: ${match.value}`;
    case 'compatibility': return `Совместимость: ${match.value}`;
    case 'metadata': return `Метаданные: ${match.value}`;
    default: return match.value;
  }
};
