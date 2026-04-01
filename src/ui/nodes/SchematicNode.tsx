import { memo } from 'react';
import { Handle, NodeProps } from 'reactflow';
import { SoapNodeData } from '../../domain/schemas/types';
import { getHandleSpecs } from '../../domain/flow/handles';
import { getSchematicSymbol } from '../../features/editor/schematicSymbols';

const symbolByShape: Record<string, string> = {
  vessel: '◯',
  reactor: '◎',
  pump: '▶',
  valve: '◇',
  instrument: '◌',
  filter: '⬠',
  mixer: '⬢',
  heater: '▭',
  terminal: '⟫',
  inline: '▫',
  generic: '□',
};

export const SchematicNode = memo(({ data, selected }: NodeProps<SoapNodeData>) => {
  const handles = getHandleSpecs(data);
  const symbol = getSchematicSymbol({ id: data.id, data, position: { x: 0, y: 0 } } as any);
  const glyph = symbolByShape[symbol.shape] ?? '□';

  return (
    <div
      className={`schematic-node shape-${symbol.shape} ${selected ? 'is-selected' : ''}`}
      style={{ width: symbol.size.width, minHeight: symbol.size.height }}
    >
      {handles.filter((handle) => handle.type === 'target').map((handle) => (
        <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />
      ))}
      <div className="schematic-node-symbol" aria-hidden>{glyph}</div>
      <div className="schematic-node-labels">
        <strong>{data.shortName || data.visibleName}</strong>
        <span>{data.technicalTag || data.visibleName}</span>
        <small>{data.kind}</small>
      </div>
      {handles.filter((handle) => handle.type === 'source').map((handle) => (
        <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />
      ))}
    </div>
  );
});
