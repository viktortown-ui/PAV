import { memo } from 'react';
import { Handle, NodeProps } from 'reactflow';
import { SoapNodeData } from '../../domain/schemas/types';
import { getHandleSpecs } from '../../domain/flow/handles';
import { getSchematicSymbol } from '../../features/editor/schematicSymbols';

const SymbolShape = ({ shape }: { shape: string }) => {
  switch (shape) {
    case 'vessel':
      return <ellipse cx="28" cy="28" rx="17" ry="22" />;
    case 'reactor':
      return <><ellipse cx="28" cy="28" rx="17" ry="22" /><path d="M20 19h16M20 37h16" /></>;
    case 'pump':
      return <><circle cx="24" cy="28" r="12" /><path d="M36 28h14M22 22l9 6-9 6" /></>;
    case 'valve':
      return <><path d="M12 28h32" /><path d="M20 18l8 10-8 10-8-10z" /><path d="M36 18l8 10-8 10-8-10z" /></>;
    case 'instrument':
      return <><circle cx="28" cy="28" r="12" /><path d="M28 16v24M16 28h24" /></>;
    case 'filter':
      return <><path d="M10 28h36" /><rect x="20" y="18" width="16" height="20" /><path d="M22 20l12 16" /></>;
    case 'heater':
      return <><rect x="12" y="18" width="32" height="20" rx="2" /><path d="M16 22h24M16 28h24M16 34h24" /></>;
    case 'terminal':
      return <><path d="M12 28h24" /><path d="M34 20l12 8-12 8" /></>;
    default:
      return <rect x="16" y="16" width="24" height="24" rx="2" />;
  }
};

export const SchematicNode = memo(({ data, selected }: NodeProps<SoapNodeData>) => {
  const handles = getHandleSpecs(data);
  const symbol = getSchematicSymbol({ id: data.id, data, position: { x: 0, y: 0 } } as any);
  const primaryLabel = data.shortName || data.visibleName;
  const secondaryLabel = data.technicalTag;
  const showSecondary = Boolean(secondaryLabel) && symbol.size.width >= 124;

  return (
    <div
      className={`schematic-node shape-${symbol.shape} ${selected ? 'is-selected' : ''}`}
      style={{ width: symbol.size.width, minHeight: symbol.size.height }}
    >
      {handles.filter((handle) => handle.type === 'target').map((handle) => (
        <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />
      ))}
      <div className="schematic-node-symbol" aria-hidden>
        <svg viewBox="0 0 56 56" role="presentation">
          <SymbolShape shape={symbol.shape} />
        </svg>
      </div>
      <div className="schematic-node-labels">
        <strong title={primaryLabel}>{primaryLabel}</strong>
        {showSecondary ? <span title={secondaryLabel}>{secondaryLabel}</span> : null}
      </div>
      {handles.filter((handle) => handle.type === 'source').map((handle) => (
        <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />
      ))}
    </div>
  );
});
