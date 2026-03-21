import { memo } from 'react';
import { Handle, NodeProps, Position, useStore } from 'reactflow';
import { IndustrialIcon } from '../icons/IndustrialIcon';
import { SoapNodeData } from '../domain/schemas/types';
import { mediumPalette, routeTone } from '../domain/visual/tokens';

export const ProcessNode = memo(({ data, selected }: NodeProps<SoapNodeData>) => {
  const zoom = useStore((state) => state.transform[2]);
  const far = zoom < 0.72;
  const near = zoom > 1.15 || selected;
  const palette = mediumPalette[data.medium];
  const inline = data.visual.semanticSize !== 'main';
  const showMetrics = !far && !inline;
  const showDetail = near && data.visual.semanticSize === 'main';
  const level = Math.round(Number(data.visual.fill ?? 0));
  const flow = Math.round(Number(data.process.flowRate ?? data.simulation.flow ?? 0));
  const status = data.simulation.routeState;

  return (
    <div className={`process-node kind-${data.kind} ${inline ? 'is-inline-node' : ''} ${selected ? 'is-selected' : ''} status-${data.status}`} style={{ ['--accent' as string]: palette.base, ['--glow' as string]: palette.glow, ['--route' as string]: routeTone[status] }}>
      {data.ports.inputs > 0 && <Handle type="target" position={Position.Left} className="port-handle" />}
      <div className="node-shell">
        <div className={`node-icon kind-${data.kind} ${data.simulation.active ? 'is-live' : ''} ${Boolean(data.process.mixingOn) && data.kind.includes('reactor') ? 'is-mixing' : ''}`}>
          <IndustrialIcon kind={data.kind} active={data.simulation.active} />
          {data.kind === 'tank' || data.kind.includes('reactor') ? <div className="vessel-fill" style={{ height: `${level}%`, background: `linear-gradient(180deg, ${palette.glow}, ${palette.fill})` }}><span className="vessel-wave" /></div> : null}
          {data.kind === 'heatedReactor' && Boolean(data.process.heatingOn) ? <span className="thermal-ring" /> : null}
        </div>
        {data.visual.showLabel && (
          <div className="node-labels">
            <div className="node-title">{far ? data.shortName : data.label}</div>
            {!far && <div className="node-subtitle">{data.tag}</div>}
          </div>
        )}
        <div className="node-badges">
          <span className={`status-dot ${data.status}`} />
          {!far && <span className="mini-badge">{status === 'flowing' ? 'Поток' : status === 'blocked' ? 'Блок' : status === 'starved' ? 'Пусто' : status === 'cip' ? 'CIP' : 'Ожидание'}</span>}
        </div>
      </div>
      {showMetrics && (
        <div className="node-metrics">
          <div><span>Уровень</span><strong>{level}%</strong></div>
          <div><span>Поток</span><strong>{flow} л/мин</strong></div>
          <div><span>Т°</span><strong>{Math.round(Number(data.process.temperature ?? 0))}°C</strong></div>
        </div>
      )}
      {showDetail && (
        <div className="node-summary">
          <span>{data.medium === 'water' ? 'Вода' : data.medium === 'product' ? 'Продукт' : data.medium === 'cip' ? 'CIP' : 'Сток'}</span>
          <span>{Math.round(Number(data.process.level ?? 0))} / {Math.round(Number(data.process.capacity ?? 0))} л</span>
          {data.kind === 'pump' && <span>{Boolean(data.process.pumpOn) ? 'Привод включён' : 'Привод остановлен'}</span>}
          {data.kind === 'valve' && <span>{Boolean(data.process.valveOpen) ? 'Клапан открыт' : 'Клапан закрыт'}</span>}
        </div>
      )}
      {data.ports.outputs > 0 && <Handle type="source" position={Position.Right} className="port-handle" />}
    </div>
  );
});
