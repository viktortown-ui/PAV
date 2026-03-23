import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { componentRegistry } from '../../domain/registry/componentRegistry';
import { hasWizardSubtype } from '../equipmentWizard/schema';
import { IndustrialIcon } from '../../icons/IndustrialIcon';
import { useAppStore } from '../../store/useAppStore';
import { groupSearchResultsByFamily, searchLibraryItems, summarizeMatchReason, ToolboxSearchScope } from './librarySearch';

type ToolboxPanelProps = {
  collapsed?: boolean;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
};

type FamilyKey = 'library' | 'sources' | 'vessels' | 'inline' | 'valves' | 'instrumentation' | 'topology' | 'more';
type FilterKey = 'all' | 'compatible';
type MoreTabKey = 'favorites' | 'recent' | 'terminals' | 'service' | 'specialty';

type RegistryItem = typeof componentRegistry[number];

type FamilyDefinition = {
  key: FamilyKey;
  label: string;
  description: string;
  tooltip: string;
  match: (item: RegistryItem) => boolean;
  icon: (active?: boolean) => JSX.Element;
};

type MoreTabDefinition = {
  key: MoreTabKey;
  label: string;
  description: string;
  match: (item: RegistryItem) => boolean;
};

const iconStroke = (active = false) => ({
  stroke: active ? '#ecf7ff' : '#b5c7de',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

const MenuIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" {...iconStroke(active)} /></svg>;
const SourceIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h6" {...iconStroke(active)} /><path d="M10 7l8 5-8 5Z" {...iconStroke(active)} /><path d="M19 5v14" {...iconStroke(active)} /></svg>;
const VesselIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3.5" width="10" height="17" rx="4" {...iconStroke(active)} /><path d="M8.5 8.5h7M8.5 15.5h7" {...iconStroke(active)} /></svg>;
const InlineIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4M17 12h4" {...iconStroke(active)} /><circle cx="11" cy="12" r="4.5" {...iconStroke(active)} /><path d="M9 12h4M11 10v4" {...iconStroke(active)} /></svg>;
const ValveIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h5M16 12h5" {...iconStroke(active)} /><path d="M8 8l4 4 4-4M8 16l4-4 4 4" {...iconStroke(active)} /></svg>;
const InstrumentIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="10" r="4.5" {...iconStroke(active)} /><path d="M12 14.5V20" {...iconStroke(active)} /><path d="M10 10h4" {...iconStroke(active)} /></svg>;
const TopologyIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M12 4v8" {...iconStroke(active)} /><circle cx="12" cy="12" r="2.2" {...iconStroke(active)} /></svg>;
const MoreIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.6" {...iconStroke(active)} /><circle cx="12" cy="12" r="1.6" {...iconStroke(active)} /><circle cx="18" cy="12" r="1.6" {...iconStroke(active)} /></svg>;
const CloseIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" {...iconStroke(false)} /></svg>;

const recentlyUsedFallback = ['pump', 'shutoffValve', 'pressureSensor', 'tee', 'tank', 'offPageConnector'];
const favoriteKinds = ['pump', 'tank', 'shutoffValve', 'pressureSensor', 'tee', 'offPageConnector'];
const emptyStateSuggestions = ['тройник', 'коллектор', 'клапан', 'расходомер', 'дренаж'];
const serviceKinds = ['serviceTerminal', 'utilityDrain', 'drainBranch', 'drainValve', 'samplePoint', 'waterFilter', 'roSkid'];
const specialtyKinds = ['collector', 'mixingJunction', 'cross', 'splitter', 'inlineMixer', 'samplePoint'];

const familyDefinitions: FamilyDefinition[] = [
  { key: 'library', label: 'Библиотека', description: 'Все элементы библиотеки.', tooltip: 'Библиотека', match: () => true, icon: (active) => <MenuIcon active={active} /> },
  { key: 'sources', label: 'Источники', description: 'Подача и подготовка среды.', tooltip: 'Источники', match: (item) => item.type === 'source' || item.type === 'roSkid' || item.type === 'waterFilter', icon: (active) => <SourceIcon active={active} /> },
  { key: 'vessels', label: 'Аппараты', description: 'Ёмкости и реакторы.', tooltip: 'Аппараты', match: (item) => item.family === 'vessel', icon: (active) => <VesselIcon active={active} /> },
  { key: 'inline', label: 'Линия', description: 'Насосы и линейные узлы.', tooltip: 'Линия', match: (item) => item.family === 'machinery', icon: (active) => <InlineIcon active={active} /> },
  { key: 'valves', label: 'Арматура', description: 'Клапаны и задвижки.', tooltip: 'Арматура', match: (item) => item.family === 'valve', icon: (active) => <ValveIcon active={active} /> },
  { key: 'instrumentation', label: 'КИП', description: 'Датчики и индикация.', tooltip: 'КИП', match: (item) => item.family === 'instrument', icon: (active) => <InstrumentIcon active={active} /> },
  { key: 'topology', label: 'Топология', description: 'Ветки и соединения.', tooltip: 'Топология', match: (item) => item.family === 'topology', icon: (active) => <TopologyIcon active={active} /> },
  { key: 'more', label: 'Ещё', description: 'Дополнительные наборы.', tooltip: 'Ещё', match: () => false, icon: (active) => <MoreIcon active={active} /> },
];

const moreTabDefinitions: MoreTabDefinition[] = [
  { key: 'favorites', label: 'Избранное', description: 'Часто используемые элементы.', match: (item) => favoriteKinds.includes(item.type) },
  { key: 'recent', label: 'Недавние', description: 'Недавно добавленные элементы.', match: (item) => recentlyUsedFallback.includes(item.type) },
  { key: 'terminals', label: 'Терминалы', description: 'Граничные точки схемы.', match: (item) => item.family === 'terminal' },
  { key: 'service', label: 'Сервис', description: 'Сервис и дренаж.', match: (item) => serviceKinds.includes(item.type) },
  { key: 'specialty', label: 'Спецузлы', description: 'Редкие узлы.', match: (item) => specialtyKinds.includes(item.type) },
];

const filterChips: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'compatible', label: 'Совместимые' },
];

const insertionHint = (item: RegistryItem) => item.placementNote
  ? item.family === 'vessel'
    ? 'Аппарат'
    : item.family === 'terminal'
      ? 'Точка'
      : 'В линию'
  : 'На схему';

const applySecondaryFilter = (items: RegistryItem[], activeFilter: FilterKey, compatibleKinds: Set<string>) => {
  switch (activeFilter) {
    case 'compatible': return items.filter((item) => compatibleKinds.has(item.type));
    case 'all':
    default: return items;
  }
};

export const ToolboxPanel = ({ collapsed = false, drawerOpen = true, onToggleDrawer }: ToolboxPanelProps) => {
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);
  const addNode = useAppStore((state) => state.addNode);
  const openEquipmentWizard = useAppStore((state) => state.openEquipmentWizard);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const project = useAppStore((state) => state.project);
  const [activeFamily, setActiveFamily] = useState<FamilyKey>('library');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchScope, setSearchScope] = useState<ToolboxSearchScope>('global');
  const [activeMoreTab, setActiveMoreTab] = useState<MoreTabKey>('favorites');
  const [activeResultIndex, setActiveResultIndex] = useState(0);

  useEffect(() => {
    setActiveResultIndex(0);
  }, [search, activeFamily, activeFilter, searchScope, activeMoreTab]);

  const compatibleKinds = useMemo(() => {
    const selectedNode = project.nodes.find((node) => node.id === selectedNodeId);
    if (!selectedNode) return new Set<string>();
    if (['tank', 'bufferTank', 'reactor', 'heatedReactor'].includes(selectedNode.data.kind)) return new Set(['pump', 'shutoffValve', 'pressureSensor', 'flowMeter', 'serviceTerminal']);
    if (['shutoffValve', 'gateValve', 'checkValve', 'controlValve', 'drainValve'].includes(selectedNode.data.kind)) return new Set(['checkValve', 'flowMeter', 'pressureSensor', 'offPageConnector']);
    return new Set(['pump', 'tank', 'tee', 'offPageConnector']);
  }, [project.nodes, selectedNodeId]);

  const family = familyDefinitions.find((item) => item.key === activeFamily) ?? familyDefinitions[0];
  const activeMoreCollection = moreTabDefinitions.find((item) => item.key === activeMoreTab) ?? moreTabDefinitions[0];
  const normalizedSearch = search.trim();
  const globalSearchActive = normalizedSearch.length > 0 && searchScope === 'global';

  const panelTitle = activeFamily === 'more' ? activeMoreCollection.label : family.label;
  const panelDescription = activeFamily === 'more' ? activeMoreCollection.description : family.description;

  const baseFamilyItems = useMemo(() => {
    const items = activeFamily === 'more'
      ? componentRegistry.filter((item) => activeMoreCollection.match(item))
      : componentRegistry.filter((item) => family.match(item));
    return applySecondaryFilter(items, activeFilter, compatibleKinds);
  }, [activeFamily, activeFilter, activeMoreCollection, compatibleKinds, family]);

  const familySearchResults = useMemo(() => searchLibraryItems(baseFamilyItems, normalizedSearch), [baseFamilyItems, normalizedSearch]);
  const globalSearchResults = useMemo(() => searchLibraryItems(componentRegistry, normalizedSearch), [normalizedSearch]);
  const groupedGlobalResults = useMemo(() => groupSearchResultsByFamily(globalSearchResults), [globalSearchResults]);

  const flatResults = useMemo(
    () => (globalSearchActive ? groupedGlobalResults.flatMap((group) => group.results) : familySearchResults),
    [familySearchResults, globalSearchActive, groupedGlobalResults],
  );

  const handleFamilySelect = (nextFamily: FamilyKey) => {
    setActiveFamily(nextFamily);
    if (!drawerOpen) onToggleDrawer?.();
  };

  const handleInsert = (item: RegistryItem) => {
    if (hasWizardSubtype(item.type)) openEquipmentWizard({ kind: item.type });
    else addNode(item.type);
  };

  const handleKeyNavigation = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!flatResults.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveResultIndex((value) => (value + 1) % flatResults.length);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveResultIndex((value) => (value - 1 + flatResults.length) % flatResults.length);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = flatResults[activeResultIndex];
      if (target) handleInsert(target.item);
    }
  };

  const renderItemButton = (item: RegistryItem, options?: { reason?: string; active?: boolean }) => (
    <button
      key={item.type}
      className={`toolbox-item toolbox-item-compact family-${item.family} ${options?.active ? 'is-active' : ''}`}
      onClick={() => handleInsert(item)}
      title={`${item.label}. ${item.ruDescriptionShort}`}
    >
      <span className="toolbox-icon"><IndustrialIcon kind={item.type} definition={item} /></span>
      <div className="toolbox-copy">
        <div className="toolbox-copy-head">
          <strong>{item.label}</strong>
          <span className="toolbox-code">{item.technicalPrefix}</span>
        </div>
        <small>{item.ruDescriptionShort}</small>
        {options?.reason ? <div className="toolbox-match-reason">{options.reason}</div> : null}
        <div className="toolbox-meta-row">
          <span className="toolbox-meta-pill">{item.category}</span>
          <span className="toolbox-meta-pill">{item.subtypeLabel}</span>
          <span className="toolbox-meta-pill">{insertionHint(item)}</span>
          {compatibleKinds.has(item.type) ? <span className="toolbox-meta-pill is-compatible">Совместимые</span> : null}
        </div>
      </div>
    </button>
  );

  return (
    <aside className={`toolbox-shell ${collapsed ? 'is-collapsed' : ''}`} aria-label="Левая навигация библиотеки">
      <div className="shell-rail shell-rail-left" aria-label="Семейства библиотеки">
        {familyDefinitions.map((entry) => {
          const active = drawerOpen && activeFamily === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              className={`rail-icon-button ${active ? 'is-active' : ''}`}
              title={entry.tooltip}
              aria-label={entry.tooltip}
              aria-pressed={active}
              onClick={() => handleFamilySelect(entry.key)}
            >
              <span className="rail-icon-glyph">{entry.icon(active)}</span>
            </button>
          );
        })}
      </div>

      {!collapsed && drawerOpen ? (
        <>
          <button type="button" className="toolbox-overlay-scrim" aria-label="Закрыть" onClick={onToggleDrawer} />
          <div className="toolbox-drawer panel" role="dialog" aria-modal="false" aria-label={panelTitle}>
            <div className="toolbox-drawer-header">
              <div className="toolbox-drawer-head">
                <div>
                  <div className="panel-title toolbox-family-title">{panelTitle}</div>
                  {activeFamily === 'more' ? <div className="toolbox-family-context">Ещё</div> : null}
                </div>
                <button type="button" className="toolbox-close-button" onClick={onToggleDrawer} aria-label="Закрыть" title="Закрыть">
                  <CloseIcon />
                </button>
              </div>

              <p className="panel-caption toolbox-family-description">{panelDescription}</p>

              {activeFamily === 'more' ? (
                <div className="library-chip-row library-chip-row-secondary" role="tablist" aria-label="Дополнительные наборы">
                  {moreTabDefinitions.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`library-chip ${activeMoreTab === tab.key ? 'is-active' : ''}`}
                      onClick={() => setActiveMoreTab(tab.key)}
                      aria-pressed={activeMoreTab === tab.key}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="toolbox-search-mode" role="tablist" aria-label="Область поиска">
                <button type="button" className={`library-chip library-chip-primary ${searchScope === 'global' ? 'is-active' : ''}`} onClick={() => setSearchScope('global')}>
                  Вся библиотека
                </button>
                <button type="button" className={`library-chip library-chip-primary ${searchScope === 'family' ? 'is-active' : ''}`} onClick={() => setSearchScope('family')}>
                  {activeFamily === 'more' ? 'Этот набор' : 'Это семейство'}
                </button>
              </div>

              <input
                className="panel-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={handleKeyNavigation}
                placeholder={searchScope === 'global' ? 'Поиск по библиотеке' : `Поиск в разделе «${panelTitle}»`}
                aria-label="Поиск по библиотеке"
              />

              <div className="library-chip-row library-chip-row-secondary" role="tablist" aria-label="Фильтры">
                {filterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={`library-chip ${activeFilter === chip.key ? 'is-active' : ''}`}
                    onClick={() => setActiveFilter(chip.key)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbox-list toolbox-list-dense">
              {globalSearchActive ? (
                groupedGlobalResults.length ? groupedGlobalResults.map((group) => (
                  <section key={group.family} className="toolbox-result-group">
                    <div className="toolbox-result-group-head">
                      <strong>{group.familyLabel}</strong>
                      <span>{group.results.length} результатов</span>
                    </div>
                    <div className="toolbox-group-items">
                      {group.results.map((result) => renderItemButton(result.item, {
                        reason: summarizeMatchReason(result.matchDetails[0]),
                        active: flatResults[activeResultIndex]?.item.type === result.item.type,
                      }))}
                    </div>
                  </section>
                )) : (
                  <div className="toolbox-empty-state">
                    <strong>Ничего не найдено</strong>
                    <span>Попробуйте другой запрос.</span>
                    <div className="toolbox-suggestion-row">
                      {emptyStateSuggestions.map((suggestion) => <button key={suggestion} type="button" className="library-chip" onClick={() => setSearch(suggestion)}>{suggestion}</button>)}
                    </div>
                  </div>
                )
              ) : familySearchResults.length ? familySearchResults.map((result) => renderItemButton(result.item, {
                reason: normalizedSearch ? summarizeMatchReason(result.matchDetails[0]) : undefined,
                active: flatResults[activeResultIndex]?.item.type === result.item.type,
              })) : (
                <div className="toolbox-empty-state">
                  <strong>{normalizedSearch ? 'Ничего не найдено' : 'Раздел пуст'}</strong>
                  <span>{normalizedSearch ? 'Смените область поиска.' : 'Выберите другое семейство.'}</span>
                  {normalizedSearch ? <div className="toolbox-suggestion-row"><button type="button" className="library-chip" onClick={() => setSearchScope('global')}>Вся библиотека</button></div> : null}
                </div>
              )}
            </div>

            <div className="toolbox-drawer-footer">
              <button type="button" className="primary toolbox-create-button" onClick={() => openEquipmentWizard()}>
                Создать элемент
              </button>
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
};
