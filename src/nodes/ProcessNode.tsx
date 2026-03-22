import { memo } from 'react';
import { Handle, NodeProps, Position, useStore } from 'reactflow';
import { IndustrialIcon } from '../icons/IndustrialIcon';
import { SoapNodeData } from '../domain/schemas/types';
import { mediumPalette, routeTone } from '../domain/visual/tokens';

const routeLabel: Record<SoapNodeData['simulation']['routeState'], string> = { flowing: 'Поток', blocked: 'Блок', starved: 'Пусто', cip: 'CIP', idle: 'Ожидание', alarm: 'Авария', primed: 'Готов', draining: 'Слив', offline: 'Вне линии' };
const mediumLabel: Record<SoapNodeData['medium'], string> = { water: 'Вода', product: 'Продукт', cip: 'CIP', waste: 'Сток' };

export const ProcessNode = memo(({ data, selected }: NodeProps<SoapNodeData>) => {
  const zoom = useStore((state) => state.transform[2]);
  const far = zoom < 0.72;
  const near = zoom > 1.12 || selected;
  const palette = mediumPalette[data.medium];
  const className = data.className;
  const vesselLike = className === 'major';
  const level = Math.round(Number(data.visual.fill ?? 0));
  const flow = Math.round(Number(data.process.flowRate ?? data.simulation.flow ?? 0));
  const branchCapable = data.kind === 'tee' || data.kind === 'splitter' || data.kind === 'drainBranch';

  return (
    <div className={[ 'process-node', `class-${className}`, selected ? 'is-selected' : '' ].join(' ')} style={{ ['--accent' as string]: palette.base, ['--route' as string]: routeTone[data.simulation.routeState] }}>
      {data.ports.inputs > 0 && <Handle type="target" position={Position.Left} className="port-handle" />}
      {branchCapable && <Handle id="branch-out" type="source" position={Position.Top} className="port-handle branch-port-handle" />}
      <div className="node-shell">
        <div className="node-icon"><IndustrialIcon kind={data.kind} active={data.simulation.active} />{vesselLike ? <div className="vessel-fill" style={{ height: `${level}%`, background: `linear-gradient(180deg, ${palette.glow}, ${palette.fill})` }}><span className="vessel-wave" /></div> : null}</div>
        <div className="node-copy">
          <div className="node-labels"><div className="node-title">{far ? data.shortName : data.visibleName}</div>{!far && <div className="node-subtitle">{data.technicalTag}</div>}</div>
          {!far && <div className="node-inline-meta"><span>{mediumLabel[data.medium]}</span><span>{routeLabel[data.simulation.routeState]}</span></div>}
        </div>
        <div className="node-badges"><span className={`status-dot ${data.status}`} />{className !== 'major' && !far && <span className="inline-flow">{flow}</span>}</div>
      </div>
      {vesselLike && !far && <div className="node-metrics compact"><div><span>Уровень</span><strong>{level}%</strong></div><div><span>Поток</span><strong>{flow} л/мин</strong></div><div><span>Т°</span><strong>{Math.round(Number(data.process.temperature ?? 0))}°C</strong></div></div>}
      {near && <div className="node-summary slim"><span>{data.category}</span><span>{routeLabel[data.simulation.routeState]}</span><span>{data.process.diameterNominal as string}</span><span>{data.process.activityLabel as string}</span></div>}
      {data.ports.outputs > 0 && <Handle type="source" position={Position.Right} className="port-handle" />}
    </div>
  );
});
