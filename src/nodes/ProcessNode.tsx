import { memo } from 'react';
import { Handle, NodeProps, Position, useStore } from 'reactflow';
import { IndustrialIcon } from '../icons/IndustrialIcon';
import { SoapNodeData } from '../domain/schemas/types';
import { mediumPalette, routeTone } from '../domain/visual/tokens';

const routeLabel: Record<SoapNodeData['simulation']['routeState'], string> = { flowing: 'Поток', blocked: 'Блок', starved: 'Пусто', cip: 'CIP', idle: 'Ожидание', alarm: 'Авария', primed: 'Готов', draining: 'Слив', offline: 'Вне линии' };
const mediumLabel: Record<SoapNodeData['medium'], string> = { water: 'Вода', product: 'Продукт', cip: 'CIP', waste: 'Сток' };

type HandleSpec = { id: string; type: 'source' | 'target'; position: Position; className?: string };

const getHandleSpecs = (data: SoapNodeData): HandleSpec[] => {
  const base: HandleSpec[] = [];
  const isTopology = data.className === 'topology';

  if (data.ports.inputs > 0 || isTopology) base.push({ id: 'in-left', type: 'target', position: Position.Left, className: 'port-handle handle-left' });
  if (data.ports.outputs > 0 || isTopology) base.push({ id: 'out-right', type: 'source', position: Position.Right, className: 'port-handle handle-right' });

  switch (data.kind) {
    case 'tee':
    case 'splitter':
    case 'drainBranch':
      base.push({ id: 'branch-top', type: 'source', position: Position.Top, className: 'port-handle branch-port-handle handle-top' });
      break;
    case 'cross':
      base.push({ id: 'branch-top', type: 'source', position: Position.Top, className: 'port-handle branch-port-handle handle-top' });
      base.push({ id: 'branch-bottom', type: 'target', position: Position.Bottom, className: 'port-handle branch-port-handle handle-bottom' });
      break;
    case 'collector':
    case 'mixingJunction':
      base.push({ id: 'branch-top', type: 'target', position: Position.Top, className: 'port-handle branch-port-handle handle-top' });
      break;
    case 'samplePoint':
      base.push({ id: 'branch-top', type: 'source', position: Position.Top, className: 'port-handle sample-port-handle handle-top' });
      break;
    default:
      break;
  }

  return base;
};

export const ProcessNode = memo(({ data, selected }: NodeProps<SoapNodeData>) => {
  const zoom = useStore((state) => state.transform[2]);
  const far = zoom < 0.72;
  const near = zoom > 1.12 || selected;
  const palette = mediumPalette[data.medium];
  const className = data.className;
  const vesselLike = className === 'major';
  const level = Math.round(Number(data.visual.fill ?? 0));
  const flow = Math.round(Number(data.process.flowRate ?? data.simulation.flow ?? 0));
  const handles = getHandleSpecs(data);
  const compactInline = className === 'valve' || className === 'instrument' || className === 'topology';

  return (
    <div className={[ 'process-node', `class-${className}`, compactInline ? 'is-inline-node' : '', vesselLike ? 'is-vessel-node' : '', selected ? 'is-selected' : '' ].join(' ')} style={{ ['--accent' as string]: palette.base, ['--route' as string]: routeTone[data.simulation.routeState] }}>
      {handles.filter((handle) => handle.type === 'target').map((handle) => <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />)}
      <div className="node-shell">
        <div className="node-icon"><IndustrialIcon kind={data.kind} active={data.simulation.active} />{vesselLike ? <div className="vessel-fill" style={{ height: `${level}%`, background: `linear-gradient(180deg, ${palette.glow}, ${palette.fill})` }}><span className="vessel-wave" /></div> : null}</div>
        <div className="node-copy">
          <div className="node-labels"><div className="node-title">{compactInline && !selected ? data.shortName : far ? data.shortName : data.visibleName}</div>{!far && !compactInline && <div className="node-subtitle">{data.technicalTag}</div>}</div>
          {!far && !compactInline && <div className="node-inline-meta"><span>{mediumLabel[data.medium]}</span><span>{routeLabel[data.simulation.routeState]}</span></div>}
        </div>
        <div className="node-badges"><span className={`status-dot ${data.status}`} />{className === 'line' && !far && <span className="inline-flow">{flow}</span>}</div>
      </div>
      {vesselLike && !far && <div className="node-metrics compact"><div><span>Уровень</span><strong>{level}%</strong></div><div><span>Поток</span><strong>{flow} л/мин</strong></div><div><span>Т°</span><strong>{Math.round(Number(data.process.temperature ?? 0))}°C</strong></div></div>}
      {near && !compactInline && <div className="node-summary slim"><span>{data.category}</span><span>{routeLabel[data.simulation.routeState]}</span><span>{data.process.diameterNominal as string}</span><span>{data.process.activityLabel as string}</span></div>}
      {handles.filter((handle) => handle.type === 'source').map((handle) => <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />)}
    </div>
  );
});
