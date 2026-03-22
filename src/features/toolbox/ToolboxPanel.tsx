import { componentRegistry } from '../../domain/registry/componentRegistry';
import { IndustrialIcon } from '../../icons/IndustrialIcon';
import { useAppStore } from '../../store/useAppStore';

export const ToolboxPanel = () => {
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);
  const addNode = useAppStore((state) => state.addNode);
  const grouped = componentRegistry.filter((item) => `${item.label} ${item.category} ${item.shortName}`.toLowerCase().includes(search.toLowerCase())).reduce<Record<string, typeof componentRegistry>>((acc, item) => { acc[item.category] ??= []; acc[item.category].push(item); return acc; }, {});

  return <aside className="panel toolbox-panel"><div className="panel-title">Инженерная библиотека</div><p className="panel-caption">Добавляйте оборудование, арматуру, КИП и трубные узлы по технологической логике.</p><input className="panel-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию, группе или тегу" /> <div className="toolbox-groups">{Object.entries(grouped).map(([category, items]) => <section key={category}><h3>{category}</h3><div className="toolbox-list">{items.map((item) => <button key={item.type} className="toolbox-item" onClick={() => addNode(item.type)}><span className="toolbox-icon"><IndustrialIcon kind={item.type} /></span><div><strong>{item.label}</strong><span>{item.shortName} • {item.description}</span></div></button>)}</div></section>)}</div></aside>;
};
