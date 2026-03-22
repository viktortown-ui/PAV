import { useMemo, useState } from 'react';
import { componentRegistry } from '../../domain/registry/componentRegistry';
import { hasWizardSubtype } from '../equipmentWizard/schema';
import { IndustrialIcon } from '../../icons/IndustrialIcon';
import { useAppStore } from '../../store/useAppStore';

type ToolboxPanelProps = {
  collapsed?: boolean;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
};

type FamilyKey = 'sources' | 'vessels' | 'machines' | 'valves' | 'instrumentation' | 'topology' | 'terminals' | 'favorites';

type RegistryItem = typeof componentRegistry[number];

const familyMap: Array<{ key: FamilyKey; label: string; short: string; match: (item: RegistryItem) => boolean }> = [
  { key: 'sources', label: 'Источники', short: 'ИC', match: (item) => item.type === 'source' || item.type === 'roSkid' || item.type === 'waterFilter' },
  { key: 'vessels', label: 'Аппараты', short: 'АП', match: (item) => item.family === 'vessel' },
  { key: 'machines', label: 'Inline-машины', short: 'IM', match: (item) => item.family === 'machinery' },
  { key: 'valves', label: 'Арматура', short: 'АР', match: (item) => item.family === 'valve' },
  { key: 'instrumentation', label: 'КИП', short: 'КИП', match: (item) => item.family === 'instrument' },
  { key: 'topology', label: 'Топология', short: 'ТОП', match: (item) => item.family === 'topology' },
  { key: 'terminals', label: 'Терминалы', short: 'TRM', match: (item) => item.family === 'terminal' },
  { key: 'favorites', label: 'Избранное', short: '★', match: (item) => ['pump', 'tank', 'shutoffValve', 'pressureSensor', 'tee', 'offPageConnector'].includes(item.type) },
];

const insertionHint = (item: RegistryItem) => item.placementNote
  ? item.family === 'vessel'
    ? 'Лучше вставлять как major equipment'
    : item.family === 'terminal'
      ? 'Лучше вставлять как terminal'
      : 'Лучше вставлять on line'
  : null;

export const ToolboxPanel = ({ collapsed = false, drawerOpen = true, onToggleDrawer }: ToolboxPanelProps) => {
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);
  const addNode = useAppStore((state) => state.addNode);
  const openEquipmentWizard = useAppStore((state) => state.openEquipmentWizard);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const project = useAppStore((state) => state.project);
  const [activeFamily, setActiveFamily] = useState<FamilyKey>('favorites');
  const [showPreview, setShowPreview] = useState<string | null>(null);

  const compatibleKinds = useMemo(() => {
    const selectedNode = project.nodes.find((node) => node.id === selectedNodeId);
    if (!selectedNode) return new Set<string>();
    if (['tank', 'bufferTank', 'reactor', 'heatedReactor'].includes(selectedNode.data.kind)) return new Set(['pump', 'shutoffValve', 'pressureSensor', 'flowMeter', 'serviceTerminal']);
    if (['shutoffValve', 'gateValve', 'checkValve', 'controlValve', 'drainValve'].includes(selectedNode.data.kind)) return new Set(['checkValve', 'flowMeter', 'pressureSensor', 'offPageConnector']);
    return new Set(['pump', 'tank', 'tee', 'offPageConnector']);
  }, [project.nodes, selectedNodeId]);

  const items = componentRegistry
    .filter((item) => familyMap.find((family) => family.key === activeFamily)?.match(item))
    .filter((item) => `${item.label} ${item.category} ${item.shortName} ${item.familyLabel} ${item.technicalPrefix}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <aside className={`toolbox-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="shell-rail shell-rail-left">
        <button type="button" className={`rail-toggle ${drawerOpen ? 'is-active' : ''}`} onClick={onToggleDrawer} title="Показать библиотеку">☰</button>
        {familyMap.map((family) => <button key={family.key} type="button" className={activeFamily === family.key ? 'is-active' : ''} title={family.label} onClick={() => { setActiveFamily(family.key); onToggleDrawer?.(); }}>{family.short}</button>)}
      </div>
      {drawerOpen && !collapsed ? <div className="toolbox-drawer panel"><div className="panel-title">Библиотека • {familyMap.find((family) => family.key === activeFamily)?.label}</div><p className="panel-caption">Компактный инженерный каталог: семейство, short code, русское описание и контекст вставки в одной строке. Hover открывает увеличенный предпросмотр.</p><div className="toolbox-actions"><button className="primary" onClick={() => openEquipmentWizard()}>Мастер создания</button><span>Guided setup оставлен отдельно, а raw library теперь группируется по инженерным семействам.</span></div><input className="panel-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию, тегу или семейству" /><div className="library-chip-row"><span className="library-chip is-active">Compact row</span><span className="library-chip">Preview on hover</span><span className="library-chip">Совместимые: {compatibleKinds.size}</span></div><div className="toolbox-list toolbox-list-compact">{items.map((item) => { const hint = insertionHint(item); return <button key={item.type} className={`toolbox-item toolbox-item-row family-${item.family}`} onMouseEnter={() => setShowPreview(item.type)} onMouseLeave={() => setShowPreview((value) => value === item.type ? null : value)} onClick={() => hasWizardSubtype(item.type) ? openEquipmentWizard({ kind: item.type }) : addNode(item.type)} title={`${item.label}: ${item.auditNote}`}><span className="toolbox-icon"><IndustrialIcon kind={item.type} definition={item} /></span><div className="toolbox-copy"><div className="toolbox-copy-head"><strong>{item.label}</strong><span className="toolbox-code">{item.familyLabel} • {item.technicalPrefix}</span></div><small>{item.ruDescriptionShort}</small><div className="toolbox-meta-row"><span className="toolbox-meta-pill">{item.category}</span>{hint ? <span className="toolbox-meta-pill">{hint}</span> : null}{compatibleKinds.has(item.type) ? <span className="toolbox-meta-pill is-compatible">Совместимо с выбором</span> : null}</div></div>{showPreview === item.type ? <div className="toolbox-preview"><div className="toolbox-preview-head"><span className="toolbox-preview-icon"><IndustrialIcon kind={item.type} definition={item} preview /></span><div><strong>{item.label}</strong><span>{item.familyLabel} • {item.technicalPrefix}</span></div></div><p>{item.description}</p><small>{item.placementNote ?? 'Универсальная вставка в инженерную схему.'}</small></div> : null}</button>; })}</div></div> : null}
    </aside>
  );
};
