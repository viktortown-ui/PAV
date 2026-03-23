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

type FamilyKey = 'library' | 'sources' | 'vessels' | 'machines' | 'valves' | 'instrumentation' | 'topology' | 'terminals' | 'favorites';
type FilterKey = 'all' | 'compatible' | 'favorites' | 'recent';

type RegistryItem = typeof componentRegistry[number];

type FamilyDefinition = {
  key: FamilyKey;
  label: string;
  description: string;
  tooltip: string;
  match: (item: RegistryItem) => boolean;
  icon: (active?: boolean) => JSX.Element;
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
const MachineIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4M17 12h4" {...iconStroke(active)} /><circle cx="11" cy="12" r="4.5" {...iconStroke(active)} /><path d="M13.5 9.5h2.5v5h-2.5" {...iconStroke(active)} /></svg>;
const ValveIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h5M16 12h5" {...iconStroke(active)} /><path d="M8 8l4 4 4-4M8 16l4-4 4 4" {...iconStroke(active)} /></svg>;
const InstrumentIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="10" r="4.5" {...iconStroke(active)} /><path d="M12 14.5V20" {...iconStroke(active)} /><path d="M10 10h4" {...iconStroke(active)} /></svg>;
const TopologyIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M12 4v8" {...iconStroke(active)} /><circle cx="12" cy="12" r="2.2" {...iconStroke(active)} /></svg>;
const TerminalIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h6" {...iconStroke(active)} /><path d="M10 7h7l3 5-3 5h-7Z" {...iconStroke(active)} /></svg>;
const FavoriteIcon = ({ active = false }: { active?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5l2.2 4.45 4.92.72-3.56 3.47.84 4.91L12 15.8 7.6 18.05l.84-4.91-3.56-3.47 4.92-.72Z" {...iconStroke(active)} /></svg>;
const CloseIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" {...iconStroke(false)} /></svg>;

const recentlyUsedFallback = ['pump', 'shutoffValve', 'pressureSensor', 'tee', 'tank', 'offPageConnector'];
const favoriteKinds = ['pump', 'tank', 'shutoffValve', 'pressureSensor', 'tee', 'offPageConnector'];
const emptyStateSuggestions = ['тройник', 'коллектор', 'клапан', 'расходомер', 'дренаж'];

const familyDefinitions: FamilyDefinition[] = [
  { key: 'library', label: 'Библиотека', description: 'Глобальный поиск по всему каталогу и инженерным семействам.', tooltip: 'Библиотека', match: () => true, icon: (active) => <MenuIcon active={active} /> },
  { key: 'sources', label: 'Источники', description: 'Питание, подготовка среды и входные точки процесса.', tooltip: 'Источники', match: (item) => item.type === 'source' || item.type === 'roSkid' || item.type === 'waterFilter', icon: (active) => <SourceIcon active={active} /> },
  { key: 'vessels', label: 'Аппараты', description: 'Основное емкостное и реакторное оборудование схемы.', tooltip: 'Аппараты', match: (item) => item.family === 'vessel', icon: (active) => <VesselIcon active={active} /> },
  { key: 'machines', label: 'Линейные узлы', description: 'Насосы, смесители и элементы, которые ставятся на линию.', tooltip: 'Линейные узлы', match: (item) => item.family === 'machinery', icon: (active) => <MachineIcon active={active} /> },
  { key: 'valves', label: 'Арматура', description: 'Запорно-регулирующая арматура для маршрутизации и отсечки.', tooltip: 'Арматура', match: (item) => item.family === 'valve', icon: (active) => <ValveIcon active={active} /> },
  { key: 'instrumentation', label: 'КИП', description: 'Контроль параметров процесса и измерительные точки.', tooltip: 'КИП', match: (item) => item.family === 'instrument', icon: (active) => <InstrumentIcon active={active} /> },
  { key: 'topology', label: 'Топология', description: 'Разветвления, объединения и структурные элементы трассировки.', tooltip: 'Топология', match: (item) => item.family === 'topology', icon: (active) => <TopologyIcon active={active} /> },
  { key: 'terminals', label: 'Терминалы', description: 'Внешние подключения, выходы и сервисные точки.', tooltip: 'Терминалы', match: (item) => item.family === 'terminal', icon: (active) => <TerminalIcon active={active} /> },
  { key: 'favorites', label: 'Избранное', description: 'Часто используемые элементы для быстрого старта на холсте.', tooltip: 'Избранное', match: (item) => favoriteKinds.includes(item.type), icon: (active) => <FavoriteIcon active={active} /> },
];

const filterChips: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'compatible', label: 'Совместимые' },
  { key: 'favorites', label: 'Избранное' },
  { key: 'recent', label: 'Недавние' },
];

const insertionHint = (item: RegistryItem) => item.placementNote
  ? item.family === 'vessel'
    ? 'Размещается как основной аппарат'
    : item.family === 'terminal'
      ? 'Размещается как граничная точка'
      : 'Подходит для вставки в поток'
  : 'Готов к вставке на схему';

const applySecondaryFilter = (items: RegistryItem[], activeFilter: FilterKey, compatibleKinds: Set<string>) => {
  switch (activeFilter) {
    case 'compatible': return items.filter((item) => compatibleKinds.has(item.type));
    case 'favorites': return items.filter((item) => favoriteKinds.includes(item.type));
    case 'recent': return items.filter((item) => recentlyUsedFallback.includes(item.type));
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
  const [activeFamily, setActiveFamily] = useState<FamilyKey>('favorites');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchScope, setSearchScope] = useState<ToolboxSearchScope>('global');
  const [activeResultIndex, setActiveResultIndex] = useState(0);

  useEffect(() => {
    if (collapsed || !drawerOpen) return;
    if (activeFamily === 'library') setActiveFamily('favorites');
  }, [activeFamily, collapsed, drawerOpen]);

  useEffect(() => {
    setActiveResultIndex(0);
  }, [search, activeFamily, activeFilter, searchScope]);

  const compatibleKinds = useMemo(() => {
    const selectedNode = project.nodes.find((node) => node.id === selectedNodeId);
    if (!selectedNode) return new Set<string>();
    if (['tank', 'bufferTank', 'reactor', 'heatedReactor'].includes(selectedNode.data.kind)) return new Set(['pump', 'shutoffValve', 'pressureSensor', 'flowMeter', 'serviceTerminal']);
    if (['shutoffValve', 'gateValve', 'checkValve', 'controlValve', 'drainValve'].includes(selectedNode.data.kind)) return new Set(['checkValve', 'flowMeter', 'pressureSensor', 'offPageConnector']);
    return new Set(['pump', 'tank', 'tee', 'offPageConnector']);
  }, [project.nodes, selectedNodeId]);

  const family = familyDefinitions.find((item) => item.key === activeFamily) ?? familyDefinitions[0];
  const normalizedSearch = search.trim();
  const globalSearchActive = normalizedSearch.length > 0 && searchScope === 'global';

  const baseFamilyItems = useMemo(() => {
    let items = componentRegistry.filter((item) => family.match(item));
    if (activeFamily === 'favorites') items = items.filter((item) => favoriteKinds.includes(item.type));
    return applySecondaryFilter(items, activeFilter, compatibleKinds);
  }, [activeFamily, activeFilter, compatibleKinds, family]);

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
          {compatibleKinds.has(item.type) ? <span className="toolbox-meta-pill is-compatible">Совместимо</span> : null}
        </div>
      </div>
    </button>
  );

  return (
    <aside className={`toolbox-shell ${collapsed ? 'is-collapsed' : ''}`} aria-label="Левая навигация библиотеки">
      <div className="shell-rail shell-rail-left">
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
          <button type="button" className="toolbox-overlay-scrim" aria-label="Закрыть библиотеку" onClick={onToggleDrawer} />
          <div className="toolbox-drawer panel" role="dialog" aria-modal="false" aria-label={family.label}>
            <div className="toolbox-drawer-head">
              <div>
                <div className="panel-title">{family.label}</div>
                <p className="panel-caption toolbox-family-description">{family.description}</p>
              </div>
              <button type="button" className="toolbox-close-button" onClick={onToggleDrawer} aria-label="Закрыть библиотеку" title="Закрыть библиотеку">
                <CloseIcon />
              </button>
            </div>

            <div className="toolbox-search-mode" role="tablist" aria-label="Режим поиска">
              <button type="button" className={`library-chip ${searchScope === 'global' ? 'is-active' : ''}`} onClick={() => setSearchScope('global')}>Глобально по библиотеке</button>
              <button type="button" className={`library-chip ${searchScope === 'family' ? 'is-active' : ''}`} onClick={() => setSearchScope('family')}>Только в текущем семействе</button>
            </div>

            <input
              className="panel-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleKeyNavigation}
              placeholder={searchScope === 'global' ? 'Например: тройник, коллектор, клапан, расходомер…' : `Фильтр внутри семейства «${family.label}»`}
              aria-label="Поиск по библиотеке"
            />

            <div className="toolbox-search-caption panel-caption">
              {searchScope === 'global'
                ? 'Глобальный поиск проверяет весь каталог и группирует результаты по семействам.'
                : `Локальный режим сужает результаты только внутри «${family.label}».`}
            </div>

            {!globalSearchActive ? (
              <div className="library-chip-row" role="tablist" aria-label="Фильтры библиотеки">
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
            ) : null}

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
                    <strong>Ничего не найдено во всей библиотеке</strong>
                    <span>Попробуйте один из инженерных терминов ниже или переключитесь на локальный фильтр.</span>
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
                  <strong>{normalizedSearch ? 'В текущем семействе совпадений нет' : 'Семейство пока пустое'}</strong>
                  <span>{normalizedSearch ? 'Переключите режим на глобальный поиск или попробуйте другой термин.' : 'Выберите другое семейство или создайте новый элемент.'}</span>
                  {normalizedSearch ? <div className="toolbox-suggestion-row"><button type="button" className="library-chip" onClick={() => setSearchScope('global')}>Искать во всей библиотеке</button></div> : null}
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
