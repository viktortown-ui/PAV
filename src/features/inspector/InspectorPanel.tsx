import { componentMap } from '../../domain/registry/componentRegistry';
import { PropertyField } from '../../domain/schemas/types';
import { useAppStore } from '../../store/useAppStore';

const tabs = [
  ['general', 'General'],
  ['process', 'Process'],
  ['visual', 'Visual'],
  ['ports', 'Ports'],
  ['simulation', 'Simulation'],
] as const;

export const InspectorPanel = () => {
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const project = useAppStore((state) => state.project);
  const inspectorTab = useAppStore((state) => state.inspectorTab);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const updateNodeField = useAppStore((state) => state.updateNodeField);
  const node = project.nodes.find((item) => item.id === selectedNodeId);

  if (!node) {
    return <aside className="panel inspector-panel"><div className="panel-title">Инспектор</div><p className="empty-state">Выберите узел на схеме, чтобы редактировать свойства.</p></aside>;
  }

  const key = node.data.label.toLowerCase().includes('реактор') ? 'reactor' : node.data.label.toLowerCase().includes('насос') ? 'pump' : node.data.label.toLowerCase().includes('клапан') ? 'valve' : 'tank';
  const definition = componentMap.get(key as never) ?? componentMap.get('tank')!;
  const fields: PropertyField[] = inspectorTab === 'ports'
    ? [
        { key: 'inputs', label: 'Входы', type: 'number' },
        { key: 'outputs', label: 'Выходы', type: 'number' },
      ]
    : definition.fields[inspectorTab === 'general' || inspectorTab === 'process' || inspectorTab === 'visual' || inspectorTab === 'simulation' ? inspectorTab : 'general'];

  return (
    <aside className="panel inspector-panel">
      <div className="panel-title">Инспектор</div>
      <div className="tabs">
        {tabs.map(([id, label]) => <button key={id} className={inspectorTab === id ? 'is-active' : ''} onClick={() => setInspectorTab(id)}>{label}</button>)}
      </div>
      <div className="inspector-content">
        {fields.map((field) => {
          const value = field.key === 'label' ? node.data.label
            : field.key === 'tag' ? node.data.tag
            : field.key === 'description' ? node.data.description
            : field.key === 'inputs' ? node.data.ports.inputs
            : field.key === 'outputs' ? node.data.ports.outputs
            : field.key in node.data.process ? node.data.process[field.key]
            : field.key === 'accent' ? node.data.visual.accent
            : field.key === 'fill' ? node.data.visual.fill
            : field.key === 'enabled' ? node.data.visual.enabled
            : field.key === 'mixing' ? node.data.visual.mixing
            : field.key === 'simEnabled' ? node.data.simulation.enabled
            : field.key === 'simActive' ? node.data.simulation.active
            : field.key === 'simFlow' ? node.data.simulation.flow
            : '';
          return (
            <label key={field.key} className="field">
              <span>{field.label}</span>
              {field.type === 'textarea' ? (
                <textarea value={String(value)} onChange={(e) => updateNodeField(node.id, field.key, e.target.value)} />
              ) : field.type === 'toggle' ? (
                <input type="checkbox" checked={Boolean(value)} onChange={(e) => updateNodeField(node.id, field.key, e.target.checked)} />
              ) : (
                <input type={field.type === 'number' ? 'number' : 'text'} value={String(value)} min={field.min} max={field.max} step={field.step} onChange={(e) => updateNodeField(node.id, field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)} />
              )}
            </label>
          );
        })}
      </div>
    </aside>
  );
};
