import { useMemo, useState } from 'react';
import { componentRegistry } from '../../domain/registry/componentRegistry';
import { useAppStore } from '../../store/useAppStore';
import { searchLibraryItems } from '../toolbox/librarySearch';

type LibrarySectionKey = 'favorites' | 'recent' | 'categories' | 'compatible' | 'templates';

const sectionLabels: Record<LibrarySectionKey, string> = {
  favorites: 'Избранное',
  recent: 'Недавние',
  categories: 'Категории',
  compatible: 'Совместимые',
  templates: 'Шаблоны',
};

const favorites = new Set(['pump', 'tank', 'shutoffValve', 'pressureSensor', 'tee', 'flowMeter']);
const recents = new Set(['flowMeter', 'shutoffValve', 'tank', 'tee', 'pressureSensor']);

export const LibraryPicker = () => {
  const [section, setSection] = useState<LibrarySectionKey>('favorites');
  const [query, setQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState<'all' | string>('all');
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const {
    libraryPicker,
    closeLibraryPicker,
    insertFromLibrary,
    project,
    selectedEdgeId,
  } = useAppStore((state) => ({
    libraryPicker: state.libraryPicker,
    closeLibraryPicker: state.closeLibraryPicker,
    insertFromLibrary: state.insertFromLibrary,
    project: state.project,
    selectedEdgeId: state.selectedEdgeId,
  }));

  const compatibilityKinds = useMemo(() => {
    if (libraryPicker.mode !== 'context-insert') return new Set<string>();
    const edgeId = libraryPicker.context?.edgeId ?? selectedEdgeId;
    const edge = project.edges.find((item) => item.id === edgeId);
    if (!edge) return new Set(['pump', 'shutoffValve', 'flowMeter', 'pressureSensor', 'tee']);
    const source = project.nodes.find((node) => node.id === edge.source);
    const target = project.nodes.find((node) => node.id === edge.target);
    const sourceKind = source?.data.kind ?? '';
    const targetKind = target?.data.kind ?? '';
    if ([sourceKind, targetKind].some((kind) => ['source', 'waterFilter', 'roSkid'].includes(kind))) {
      return new Set(['pump', 'flowMeter', 'pressureSensor', 'shutoffValve', 'checkValve', 'tee']);
    }
    return new Set(['pump', 'flowMeter', 'pressureSensor', 'shutoffValve', 'gateValve', 'checkValve', 'inlineFilter', 'tee', 'samplePoint']);
  }, [libraryPicker.context?.edgeId, libraryPicker.mode, project.edges, project.nodes, selectedEdgeId]);

  const families = useMemo(() => ['all', ...new Set(componentRegistry.map((item) => item.familyLabel))], []);

  const filtered = useMemo(() => {
    const bySection = componentRegistry.filter((item) => {
      if (section === 'favorites') return favorites.has(item.type);
      if (section === 'recent') return recents.has(item.type);
      if (section === 'compatible') return compatibilityKinds.has(item.type);
      return true;
    });
    const byFamily = familyFilter === 'all' ? bySection : bySection.filter((item) => item.familyLabel === familyFilter);
    return searchLibraryItems(byFamily, query);
  }, [compatibilityKinds, familyFilter, query, section]);

  const selected = useMemo(
    () => componentRegistry.find((item) => item.type === selectedKind) ?? filtered[0]?.item ?? null,
    [filtered, selectedKind],
  );

  if (!libraryPicker.open) return null;

  const contextual = libraryPicker.mode === 'context-insert';
  const title = contextual ? 'Добавить элемент в схему' : 'Библиотека элементов';
  const subtitle = contextual
    ? 'Режим вставки: показываем совместимые элементы и быстрый путь вставки.'
    : 'Глобальный режим: обзор библиотеки, категории, шаблоны и избранное.';

  return (
    <div className="library-picker-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={closeLibraryPicker}>
      <section className="library-picker-workspace" onClick={(event) => event.stopPropagation()}>
        <header className="library-picker-header">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" onClick={closeLibraryPicker} aria-label="Закрыть библиотеку">Закрыть</button>
        </header>

        <div className="library-picker-search">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={contextual ? 'Найти совместимый элемент…' : 'Поиск по библиотеке…'}
            aria-label="Поиск по библиотеке"
          />
        </div>

        <div className="library-picker-tabs" role="tablist" aria-label="Разделы библиотеки">
          {(Object.keys(sectionLabels) as LibrarySectionKey[]).map((key) => (
            <button key={key} type="button" className={section === key ? 'is-active' : ''} onClick={() => setSection(key)}>
              {sectionLabels[key]}
            </button>
          ))}
        </div>

        <div className="library-picker-filters">
          {families.map((family) => (
            <button key={family} type="button" className={familyFilter === family ? 'is-active' : ''} onClick={() => setFamilyFilter(family)}>
              {family === 'all' ? 'Все семейства' : family}
            </button>
          ))}
        </div>

        <div className="library-picker-body">
          <div className="library-picker-grid" aria-label="Карточки элементов">
            {filtered.map((result) => (
              <button key={result.item.type} type="button" className={`library-card ${selected?.type === result.item.type ? 'is-selected' : ''}`} onClick={() => setSelectedKind(result.item.type)}>
                <strong>{result.item.label}</strong>
                <span>{result.item.ruDescriptionShort}</span>
                <small>{result.item.familyLabel} • {result.item.technicalPrefix}</small>
              </button>
            ))}
            {!filtered.length ? <div className="library-empty">Ничего не найдено для текущего фильтра.</div> : null}
          </div>

          <aside className="library-picker-preview">
            {selected ? (
              <>
                <h3>{selected.label}</h3>
                <p>{selected.description}</p>
                <div className="library-picker-meta">
                  <span><b>Семейство:</b> {selected.familyLabel}</span>
                  <span><b>Категория:</b> {selected.category}</span>
                  <span><b>Подтип:</b> {selected.subtypeLabel}</span>
                  <span><b>Контекст:</b> {selected.placementNote ?? 'На схему'}</span>
                </div>
                <div className="library-picker-actions">
                  <button type="button" className="primary" onClick={() => insertFromLibrary(selected.type)}>
                    {contextual ? 'Вставить в схему' : 'Добавить в схему'}
                  </button>
                  <button type="button" onClick={closeLibraryPicker}>Отмена</button>
                </div>
              </>
            ) : (
              <p className="empty-state">Выберите элемент из списка, чтобы увидеть подробности.</p>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
};
