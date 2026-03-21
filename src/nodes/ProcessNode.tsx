import { memo } from 'react';
import { Handle, NodeProps, Position, useStore } from 'reactflow';
import { IndustrialIcon } from '../icons/IndustrialIcon';
import { SoapNodeData } from '../domain/schemas/types';
import { mediumPalette, routeTone } from '../domain/visual/tokens';

const routeLabel: Record<SoapNodeData['simulation']['routeState'], string> = {
  flowing: 'Поток',
  blocked: 'Блок',
  starved: 'Пусто',
  cip: 'CIP',
  idle: 'Ожидание',
  alarm: 'Авария',
  primed: 'Готов',
  draining: 'Слив',
  offline: 'Вне линии',
};

const mediumLabel: Record<SoapNodeData['medium'], string> = {
  water: 'Вода',
  product: 'Продукт',
  cip: 'CIP',
  waste: 'Сток',
};

export const ProcessNode = memo(({ data, selected }: NodeProps<SoapNodeData>) => {
  const zoom = useStore((state) => state.transform[2]);
  const far = zoom < 0.72;
  const near = zoom > 1.15 || selected;
  const inline = data.visual.semanticSize !== 'main';
  const vesselLike = data.kind === 'tank' || data.kind.includes('reactor');
  const palette = mediumPalette[data.medium];
  const level = Math.round(Number(data.visual.fill ?? 0));
  const flow = Math.round(Number(data.process.flowRate ?? data.simulation.flow ?? 0));
  const status = data.simulation.routeState;
  const showMetrics = vesselLike && !far && !inline;
  const showDetail = near && !inline;
  const title = far ? data.shortName : data.label;

  return (
    <div
      className={[
        'process-node',
        vesselLike ? 'is-vessel-node' : 'is-inline-node',
        selected ? 'is-selected' : '',
        `kind-${data.kind}`,
        `status-${data.status}`,
      ].filter(Boolean).join(' ')}
      style={{
        ['--accent' as string]: palette.base,
        ['--glow' as string]: palette.glow,
        ['--route' as string]: routeTone[status],
      }}
    >
      {data.ports.inputs > 0 && <Handle type="target" position={Position.Left} className="port-handle" />}
      <div className="node-shell">
        <div
          className={[
            'node-icon',
            data.simulation.active ? 'is-live' : '',
            Boolean(data.process.mixingOn) && data.kind.includes('reactor') ? 'is-mixing' : '',
          ].filter(Boolean).join(' ')}
        >
          <IndustrialIcon kind={data.kind} active={data.simulation.active} />
          {vesselLike ? (
            <div
              className="vessel-fill"
              style={{ height: `${level}%`, background: `linear-gradient(180deg, ${palette.glow}, ${palette.fill})` }}
            >
              <span className="vessel-wave" />
            </div>
          ) : null}
          {data.kind === 'heatedReactor' && Boolean(data.process.heatingOn) ? <span className="thermal-ring" /> : null}
        </div>

        <div className="node-copy">
          {data.visual.showLabel && (
            <div className="node-labels">
              <div className="node-title">{title}</div>
              {!far && <div className="node-subtitle">{data.tag}</div>}
            </div>
          )}
          {!far && !inline && (
            <div className="node-inline-meta">
              <span>{mediumLabel[data.medium]}</span>
              <span>{routeLabel[status]}</span>
            </div>
          )}
        </div>

        <div className="node-badges">
          <span className={`status-dot ${data.status}`} />
          {!far && inline && <span className="inline-flow">{flow}</span>}
        </div>
      </div>

      {showMetrics && (
        <div className="node-metrics compact">
          <div><span>Уровень</span><strong>{level}%</strong></div>
          <div><span>Поток</span><strong>{flow} л/мин</strong></div>
          <div><span>Т°</span><strong>{Math.round(Number(data.process.temperature ?? 0))}°C</strong></div>
        </div>
      )}

      {showDetail && (
        <div className="node-summary slim">
          <span>{mediumLabel[data.medium]}</span>
          <span>{routeLabel[status]}</span>
          {vesselLike ? <span>{Math.round(Number(data.process.level ?? 0))} / {Math.round(Number(data.process.capacity ?? 0))} л</span> : null}
          {data.kind === 'pump' && <span>{Boolean(data.process.pumpOn) ? 'Привод включён' : 'Привод остановлен'}</span>}
          {data.kind === 'valve' && <span>{Boolean(data.process.valveOpen) ? 'Клапан открыт' : 'Клапан закрыт'}</span>}
        </div>
      )}
      {data.ports.outputs > 0 && <Handle type="source" position={Position.Right} className="port-handle" />}
    </div>
  );
});
