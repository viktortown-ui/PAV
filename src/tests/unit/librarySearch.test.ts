import { describe, expect, it } from 'vitest';
import { componentRegistry } from '../../domain/registry/componentRegistry';
import { groupSearchResultsByFamily, searchLibraryItems } from '../../features/toolbox/librarySearch';

const labels = (query: string) => searchLibraryItems(componentRegistry, query).map((result) => result.item.label);

describe('library search', () => {
  it('finds engineering terms globally through aliases and metadata', () => {
    expect(labels('тройник')).toContain('Тройник');
    expect(labels('коллектор')).toContain('Коллектор');
    expect(labels('клапан')).toContain('Отсечной клапан');
    expect(labels('расходомер')).toContain('Расходомер');
    expect(labels('дренаж')).toEqual(expect.arrayContaining(['Дренажное ответвление', 'Дренажный коллектор', 'Дренажный клапан']));
  });

  it('groups global results by family', () => {
    const grouped = groupSearchResultsByFamily(searchLibraryItems(componentRegistry, 'коллектор'));
    expect(grouped[0]?.family).toBe('topology');
    expect(grouped[0]?.results.some((result) => result.item.label === 'Коллектор')).toBe(true);
  });

  it('matches subtype and library tags, not only visible labels', () => {
    const results = searchLibraryItems(componentRegistry, 'routing');
    expect(results.some((result) => result.item.label === 'Тройник')).toBe(true);
  });
});
