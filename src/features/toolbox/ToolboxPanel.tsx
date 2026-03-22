import { componentRegistry } from '../../domain/registry/componentRegistry';
import { IndustrialIcon } from '../../icons/IndustrialIcon';
import { useAppStore } from '../../store/useAppStore';

export const ToolboxPanel = () => {
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);
  const addNode = useAppStore((state) => state.addNode);
  const filtered = componentRegistry.filter((item) => `${item.label} ${item.category} ${item.shortName} ${item.familyLabel} ${item.technicalPrefix}`.toLowerCase().includes(search.toLowerCase()));
  const grouped = filtered.reduce<Record<string, typeof componentRegistry>>((acc, item) => { acc[item.category] ??= []; acc[item.category].push(item); return acc; }, {});

  return (
    <aside className="panel toolbox-panel">
      <div className="panel-title">Инженерная библиотека</div>
      <p className="panel-caption">Библиотека перестроена по инженерным семействам: аппараты, inline-машины, арматура, КИП, топология и терминалы.</p>
      <input className="panel-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию, группе, семейству или тегу" />
      <div className="toolbox-groups">
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category}>
            <h3>{category}</h3>
            <div className="toolbox-list">
              {items.map((item) => (
                <button key={item.type} className={`toolbox-item family-${item.family}`} onClick={() => addNode(item.type)} title={`${item.label}: ${item.auditNote}`}>
                  <span className="toolbox-icon"><IndustrialIcon kind={item.type} definition={item} /></span>
                  <div className="toolbox-copy">
                    <strong>{item.label}</strong>
                    <span>{item.familyLabel} • {item.technicalPrefix}</span>
                    <small>{item.ruDescriptionShort}</small>
                  </div>
                  <div className="toolbox-preview">
                    <div className="toolbox-preview-head">
                      <span className="toolbox-preview-icon"><IndustrialIcon kind={item.type} definition={item} preview /></span>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.familyLabel}</span>
                      </div>
                    </div>
                    <p>{item.description}</p>
                    <dl>
                      <div><dt>Класс</dt><dd>{item.className}</dd></div>
                      <div><dt>Назначение</dt><dd>{item.ruDescriptionShort}</dd></div>
                      {item.placementNote ? <div><dt>Обычно ставится</dt><dd>{item.placementNote}</dd></div> : null}
                    </dl>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
};
