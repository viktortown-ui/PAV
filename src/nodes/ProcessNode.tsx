import { memo, useEffect } from 'react';
import { Handle, NodeProps, useStore, useUpdateNodeInternals } from 'reactflow';
import { IndustrialIcon } from '../icons/IndustrialIcon';
import { SoapNodeData } from '../domain/schemas/types';
import { mediumPalette, routeTone } from '../domain/visual/tokens';
import { getHandleSpecs } from '../domain/flow/handles';

const routeLabel: Record<SoapNodeData['simulation']['routeState'], string> = { flowing: 'Поток', blocked: 'Блок', starved: 'Пусто', cip: 'CIP', idle: 'Ожидание', alarm: 'Авария', primed: 'Готов', draining: 'Слив', offline: 'Вне линии' };
const mediumLabel: Record<SoapNodeData['medium'], string> = { water: 'Вода', product: 'Продукт', cip: 'CIP', waste: 'Сток' };

export const ProcessNode = memo(({ id, data, selected }: NodeProps<SoapNodeData>) => {
  const zoom = useStore((state) => state.transform[2]);
  const updateNodeInternals = useUpdateNodeInternals();
  const far = zoom < 0.72;
  const near = zoom > 1.12 || selected;
  const palette = mediumPalette[data.medium];
  const className = data.className;
  const vesselLike = className === 'major';
  const lineEquipment = className === 'line';
  const microInline = className === 'valve' || className === 'instrument';
  const topologyNode = className === 'topology';
  const level = Math.round(Number(data.visual.fill ?? 0));
  const flow = Math.round(Number(data.process.flowRate ?? data.simulation.flow ?? 0));
  const handles = getHandleSpecs(data);
  const compactInline = microInline || topologyNode;
  const showInlineInspectorMeta = selected && (lineEquipment || microInline);

  useEffect(() => {
    updateNodeInternals(id);
  }, [data.className, data.kind, data.ports.inputs, data.ports.outputs, id, updateNodeInternals]);

  return (
    <div className={[ 'process-node', `class-${className}`, compactInline ? 'is-inline-node' : '', vesselLike ? 'is-vessel-node' : '', selected ? 'is-selected' : '' ].join(' ')} style={{ ['--accent' as string]: palette.base, ['--route' as string]: routeTone[data.simulation.routeState] }}>
      {handles.filter((handle) => handle.type === 'target').map((handle) => <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />)}
      <div className="node-shell">
        <div className="node-icon"><IndustrialIcon kind={data.kind} active={data.simulation.active} />{vesselLike ? <div className="vessel-fill" style={{ height: `${level}%`, background: `linear-gradient(180deg, ${palette.glow}, ${palette.fill})` }}><span className="vessel-wave" /></div> : null}</div>
        <div className="node-copy">
          <div className="node-labels">
            <div className="node-title">
              {compactInline && !selected ? data.shortName : lineEquipment && !selected ? (far ? data.shortName : data.visibleName) : far ? data.shortName : data.visibleName}
            </div>
            {(!far && vesselLike) || showInlineInspectorMeta ? <div className="node-subtitle">{data.technicalTag}</div> : null}
          </div>
          {vesselLike && !far && <div className="node-inline-meta"><span>{mediumLabel[data.medium]}</span><span>{routeLabel[data.simulation.routeState]}</span></div>}
        </div>
        <div className="node-badges"><span className={`status-dot ${data.status}`} />{lineEquipment && !far && !selected && <span className="inline-flow">{flow}</span>}</div>
      </div>
      {vesselLike && !far && <div className="node-metrics compact"><div><span>Уровень</span><strong>{level}%</strong></div><div><span>Поток</span><strong>{flow} л/мин</strong></div><div><span>Т°</span><strong>{Math.round(Number(data.process.temperature ?? 0))}°C</strong></div></div>}
      {near && vesselLike && <div className="node-summary slim"><span>{data.category}</span><span>{routeLabel[data.simulation.routeState]}</span><span>{data.process.diameterNominal as string}</span><span>{data.process.activityLabel as string}</span></div>}
      {showInlineInspectorMeta && <div className="node-summary inline-summary"><span>{data.category}</span><span>{routeLabel[data.simulation.routeState]}</span></div>}
      {handles.filter((handle) => handle.type === 'source').map((handle) => <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />)}
    </div>
  );
});
