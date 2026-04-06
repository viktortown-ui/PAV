import { memo, useEffect } from 'react';
import { Handle, NodeProps, useStore, useUpdateNodeInternals } from 'reactflow';
import { IndustrialIcon } from '../../icons/IndustrialIcon';
import { SoapNodeData } from '../../domain/schemas/types';
import { getHandleSpecs } from '../../domain/flow/handles';
import { useAppStore } from '../../store/useAppStore';
import { getEquipmentVisualProfile, resolveLodLevel } from '../../features/simulation/equipmentVisualRegistry';

const stateLabel: Record<string, string> = {
  running: 'РАБ',
  off: 'ВЫКЛ',
  standby: 'ОЖД',
  alarm: 'АВР',
  blocked: 'БЛК',
  manual: 'РУЧ',
  maintenance: 'СЕРВ',
  unknown: '???',
};

export const ProcessNode = memo(({ id, data, selected }: NodeProps<SoapNodeData>) => {
  const zoom = useStore((state) => state.transform[2]);
  const presentationMode = useAppStore((state) => state.project.view.presentationMode);
  const updateNodeInternals = useUpdateNodeInternals();
  const lod = resolveLodLevel(zoom, selected);
  const visual = getEquipmentVisualProfile(data, lod);
  const handles = getHandleSpecs(data);

  useEffect(() => {
    updateNodeInternals(id);
  }, [data.className, data.kind, data.ports.inputs, data.ports.outputs, id, updateNodeInternals]);

  return (
    <div
      className={[
        'process-node',
        'process-node-minimal',
        `lod-${lod}`,
        selected ? 'is-selected' : '',
      ].join(' ')}
      style={{ ['--equipment-color' as string]: visual.categoryColor, ['--equipment-stroke' as string]: visual.strokeColor }}
    >
      {handles.filter((handle) => handle.type === 'target').map((handle) => <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />)}
      <div className="node-shell clean">
        <div className="node-icon clean" aria-label={visual.svgVariant}>
          <IndustrialIcon kind={data.kind} active={visual.stateIndicator === 'running'} />
        </div>
        <div className="node-copy clean">
          <div className="node-title">{visual.shortLabel}</div>
          {visual.showName ? <div className="node-subtitle">{data.technicalTag}</div> : null}
        </div>
        <div className="node-badges clean">
          <span className={`status-indicator state-${visual.stateIndicator}`} title={visual.stateIndicator} />
          {lod !== 'far' ? <span className="mini-badge state-badge">{stateLabel[visual.stateIndicator]}</span> : null}
        </div>
      </div>
      {presentationMode === 'simulation' && visual.showSecondary ? (
        <div className="node-summary clean">
          <span>{data.category}</span>
          <span>{String(data.mode).toUpperCase()}</span>
        </div>
      ) : null}
      {handles.filter((handle) => handle.type === 'source').map((handle) => <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />)}
    </div>
  );
});
