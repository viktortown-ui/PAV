import { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { IndustrialIcon } from '../icons/IndustrialIcon';
import { SoapNodeData } from '../domain/schemas/types';

const statusClass = {
  normal: 'is-normal',
  active: 'is-active',
  warning: 'is-warning',
  alarm: 'is-alarm',
  disabled: 'is-disabled',
};

export const ProcessNode = memo(({ data, selected }: NodeProps<SoapNodeData>) => {
  const kind = data.tag.toLowerCase().includes('pump') || data.label.toLowerCase().includes('насос')
    ? 'pump'
    : data.category.includes('Датчики')
      ? 'sensor'
      : data.category.includes('Арматура')
        ? 'valve'
        : data.category.includes('Финишинг')
          ? 'filling'
          : data.category.includes('Подготовка воды') && data.label.toLowerCase().includes('осмос')
            ? 'ro'
            : data.category.includes('Подготовка воды') && data.label.toLowerCase().includes('фильтр')
              ? 'filter'
              : data.category.includes('Подготовка воды') && data.label.toLowerCase().includes('вода')
                ? 'inlet'
                : data.label.toLowerCase().includes('реактор')
                  ? 'reactor'
                  : 'tank';

  return (
    <div className={`process-node ${statusClass[data.status]} ${selected ? 'is-selected' : ''}`} style={{ ['--accent' as string]: data.visual.accent }}>
      <Handle type="target" position={Position.Left} className="port-handle" />
      <div className="node-header">
        <div className={`node-icon ${data.visual.mixing ? 'is-mixing' : ''} ${data.simulation.active ? 'is-live' : ''}`}>
          <IndustrialIcon kind={kind} active={data.simulation.active} />
        </div>
        <div>
          <div className="node-title">{data.label}</div>
          <div className="node-subtitle">{data.tag}</div>
        </div>
      </div>
      <div className="node-body">
        <div className="metric"><span>Уровень</span><strong>{Math.round(Number(data.visual.fill))}%</strong></div>
        <div className="metric"><span>Поток</span><strong>{Number(data.process.flowRate)} л/мин</strong></div>
        <div className="metric"><span>Т°</span><strong>{Number(data.process.temperature)}°C</strong></div>
      </div>
      <div className="node-status-row">
        <span className={`status-pill ${data.simulation.active ? 'is-on' : ''}`}>{data.simulation.active ? 'Поток' : 'Ожидание'}</span>
        {data.simulation.blocked && <span className="status-pill is-warning">Блок</span>}
      </div>
      <div className="liquid-tank"><div className="liquid-fill" style={{ height: `${data.visual.fill}%` }} /></div>
      <Handle type="source" position={Position.Right} className="port-handle" />
    </div>
  );
});
