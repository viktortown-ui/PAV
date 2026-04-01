import { memo } from 'react';
import { Handle, NodeProps } from 'reactflow';
import { SoapNodeData } from '../../domain/schemas/types';
import { getHandleSpecs } from '../../domain/flow/handles';

const symbolByKind: Partial<Record<SoapNodeData['kind'], string>> = {
  tank: '◯',
  bufferTank: '◯',
  reactor: '◎',
  heatedReactor: '◎',
  pump: '▶',
  dosingPump: '▶',
  heatExchanger: '▭',
  manualValve: '◇',
  shutoffValve: '◇',
  solenoidValve: '◇',
  checkValve: '◇',
  controlValve: '◇',
  gateValve: '◇',
  drainValve: '◇',
  reliefValve: '◇',
  flowMeter: '◌',
  pressureSensor: '◌',
  temperatureSensor: '◌',
  levelSensor: '◌',
  inlineFilter: '⬠',
  inlineMixer: '⬢',
  source: '⟪',
  consumer: '⟫',
  utilityDrain: '⟫',
  serviceTerminal: '⟫',
};

export const SchematicNode = memo(({ data, selected }: NodeProps<SoapNodeData>) => {
  const handles = getHandleSpecs(data);
  const symbol = symbolByKind[data.kind] ?? '□';
  const inline = data.className === 'valve' || data.className === 'instrument' || data.ports.inline;
  return (
    <div className={`schematic-node ${inline ? 'is-inline' : ''} ${selected ? 'is-selected' : ''}`}>
      {handles.filter((handle) => handle.type === 'target').map((handle) => (
        <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />
      ))}
      <div className="schematic-node-symbol" aria-hidden>{symbol}</div>
      <div className="schematic-node-labels">
        <strong>{data.shortName || data.visibleName}</strong>
        <span>{data.technicalTag}</span>
        <small>{data.kind}</small>
      </div>
      {handles.filter((handle) => handle.type === 'source').map((handle) => (
        <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />
      ))}
    </div>
  );
});
