import { memo, useEffect } from 'react';
import { Handle, NodeProps, useStore, useUpdateNodeInternals } from 'reactflow';
import { SoapNodeData } from '../../domain/schemas/types';
import { getHandleSpecs } from '../../domain/flow/handles';
import { useAppStore } from '../../store/useAppStore';
import { getEquipmentVisualProfile, resolveLodLevel } from '../../features/simulation/equipmentVisualRegistry';
import { EquipmentSprite } from '../../features/simulation/EquipmentSprite';

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
        'process-node-sprite',
        `lod-${lod}`,
        selected ? 'is-selected' : '',
      ].join(' ')}
      style={{ ['--equipment-color' as string]: visual.categoryColor, ['--equipment-stroke' as string]: visual.strokeColor }}
    >
      {handles.filter((handle) => handle.type === 'target').map((handle) => <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />)}
      <svg className="equipment-sprite" viewBox="0 0 80 80" role="img" aria-label={visual.spriteComponent}>
        <EquipmentSprite kind={data.kind} stroke={visual.strokeColor} color={visual.categoryColor} />
      </svg>
      <div className="equipment-status-layer">
        <span className={`status-indicator state-${visual.stateIndicator}`} title={visual.stateIndicator} />
        <span className="equipment-type-dot" />
      </div>
      <div className="node-copy clean">
        <div className="node-title">{visual.shortLabel}</div>
        {visual.showName ? <div className="node-subtitle">{data.technicalTag}</div> : null}
        {presentationMode === 'simulation' && visual.showSecondary ? <div className="node-secondary">{stateLabel[visual.stateIndicator]}</div> : null}
      </div>
      {handles.filter((handle) => handle.type === 'source').map((handle) => <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />)}
    </div>
  );
});
