import { memo, useEffect } from 'react';
import { Handle, NodeProps, useStore, useUpdateNodeInternals } from 'reactflow';
import { IndustrialIcon } from '../../icons/IndustrialIcon';
import { RouteState, SoapNodeData } from '../../domain/schemas/types';
import { mediumPalette, routeTone } from '../tokens/tokens';
import { getHandleSpecs } from '../../domain/flow/handles';
import { useAppStore } from '../../store/useAppStore';

const routeLabel: Record<SoapNodeData['simulation']['routeState'], string> = { flowing: 'Поток', blocked: 'Блок', starved: 'Пусто', cip: 'CIP', idle: 'Ожидание', alarm: 'Авария', primed: 'Готов', draining: 'Слив', maintenance: 'Ремонт', offline: 'Вне линии' };
const mediumLabel: Record<SoapNodeData['medium'], string> = { water: 'Вода', product: 'Продукт', cip: 'CIP', waste: 'Сток' };
const stateClassMap: Record<RouteState, string> = { flowing: 'is-flowing', blocked: 'is-blocked', starved: 'is-starved', idle: 'is-idle', alarm: 'is-alarm', draining: 'is-draining', cip: 'is-cip', primed: 'is-primed', maintenance: 'is-maintenance', offline: 'is-offline' };

export const ProcessNode = memo(({ id, data, selected }: NodeProps<SoapNodeData>) => {
  const zoom = useStore((state) => state.transform[2]);
  const simulationStatus = useAppStore((state) => state.project.simulation.status ?? (state.project.simulation.running ? 'running' : 'idle'));
  const updateNodeInternals = useUpdateNodeInternals();
  const far = zoom < 0.72;
  const near = zoom > 1.12 || selected;
  const palette = mediumPalette[data.medium];
  const className = data.className;
  const vesselLike = className === 'major';
  const lineEquipment = className === 'line';
  const microInline = className === 'valve' || className === 'instrument';
  const topologyNode = className === 'topology';
  const routeState = data.simulation.routeState;
  const level = Math.round(Number(data.visual.fill ?? (data.process as any).levelPercent ?? 0));
  const flow = Math.round(Number(data.process.flowRate ?? data.process.actualFlowLpm ?? data.simulation.flow ?? 0));
  const handles = getHandleSpecs(data);
  const compactInline = microInline || topologyNode;
  const terminalNode = data.className === 'terminal';
  const showInlineInspectorMeta = selected && (lineEquipment || microInline || terminalNode);
  const lowLevel = vesselLike && level <= 12;
  const isAlarmed = data.status === 'alarm' || routeState === 'alarm' || data.alarms.length > 0;
  const isRunning = data.status === 'running' || routeState === 'flowing' || routeState === 'cip' || routeState === 'draining';
  const isRunningVisual = isRunning && simulationStatus === 'running';
  const blockedState = data.status === 'blocked' || routeState === 'blocked';
  const stateBadge = data.visual.stateBadge ?? (isAlarmed ? 'АВР' : blockedState ? 'БЛК' : isRunning ? 'РАБ' : lowLevel ? 'НИЗК' : routeLabel[routeState]);
  const process = data.process as any;
  const heatingOn = Boolean(process.heatingOn);
  const agitatorOn = Boolean(process.agitatorOn ?? process.mixingOn);
  const valveOpen = Boolean(process.isOpen ?? process.valveOpen ?? process.valveState !== 'closed');
  const flowDirectionLabel = routeState === 'blocked' ? 'Поток остановлен' : routeState === 'starved' ? 'Нет подпитки' : routeState === 'draining' ? 'Дренаж активен' : routeState === 'flowing' || routeState === 'cip' ? 'Поток активен' : 'Линия в ожидании';

  useEffect(() => {
    updateNodeInternals(id);
  }, [data.className, data.kind, data.ports.inputs, data.ports.outputs, id, updateNodeInternals]);

  return (
    <div className={[
      'process-node',
      `class-${className}`,
      compactInline ? 'is-inline-node' : '',
      terminalNode ? 'is-terminal-node' : '',
      vesselLike ? 'is-vessel-node' : '',
      selected ? 'is-selected' : '',
      `sim-${simulationStatus}`,
      stateClassMap[routeState],
      lowLevel ? 'is-low-level' : '',
      isAlarmed ? 'has-alarm' : '',
      isRunning ? 'is-operating' : '',
    ].join(' ')} style={{ ['--accent' as string]: palette.base, ['--route' as string]: routeTone[routeState], ['--fill-level' as string]: `${level}%` }}>
      {handles.filter((handle) => handle.type === 'target').map((handle) => <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />)}
      <div className="node-shell">
        <div className={`node-icon ${isRunningVisual ? 'is-live' : ''} ${agitatorOn && simulationStatus === 'running' ? 'is-mixing' : ''} ${data.className === 'valve' ? 'is-valve-icon' : ''} ${data.className === 'instrument' ? 'is-instrument-icon' : ''} ${terminalNode ? 'is-terminal-icon' : ''}`}>
          <IndustrialIcon kind={data.kind} active={data.simulation.active} />
          {vesselLike ? <div className={`vessel-fill ${lowLevel ? 'is-low' : ''}`} style={{ height: `${level}%`, background: `linear-gradient(180deg, ${palette.glow}, ${palette.fill})` }}><span className="vessel-wave" /></div> : null}
          {heatingOn ? <span className="thermal-ring" /> : null}
          {lineEquipment && isRunningVisual ? <span className="equipment-spinner" /> : null}
        </div>
        <div className="node-copy">
          <div className="node-labels">
            <div className="node-title">
              {compactInline && !selected ? data.shortName : lineEquipment && !selected ? (far ? data.shortName : data.visibleName) : far ? data.shortName : data.visibleName}
            </div>
            {((!far && vesselLike) || showInlineInspectorMeta || (!far && lineEquipment)) ? <div className="node-subtitle">{data.technicalTag}</div> : null}
          </div>
          {vesselLike && !far && <div className="node-inline-meta"><span>{mediumLabel[data.medium]}</span><span>{routeLabel[routeState]}</span><span>{flowDirectionLabel}</span></div>}
          {!vesselLike && !far && (lineEquipment || microInline || terminalNode) ? <div className="node-inline-meta inline-state"><span>{routeLabel[routeState]}</span>{data.className === 'valve' ? <span>{valveOpen ? 'Открыт' : 'Закрыт'}</span> : null}{data.className === 'instrument' ? <span>КИП</span> : null}{terminalNode ? <span>Терминал</span> : null}{isAlarmed ? <span>Тревога</span> : null}</div> : null}
        </div>
        <div className="node-badges">
          <span className={`status-dot ${data.status}`} />
          <span className={`mini-badge state-badge ${routeState === 'alarm' ? 'is-alarm' : blockedState ? 'is-blocked' : isRunning ? 'is-running' : lowLevel ? 'is-warning' : ''}`}>{stateBadge}</span>
          {lineEquipment && !far && !selected && <span className="inline-flow">{flow} л/м</span>}
        </div>
      </div>
      {vesselLike && !far && <div className="node-metrics compact"><div><span>Уровень</span><strong>{level}%</strong></div><div><span>Поток</span><strong>{flow} л/мин</strong></div><div><span>Т°</span><strong>{Math.round(Number(process.temperatureC ?? process.temperature ?? 0))}°C</strong></div></div>}
      {near && vesselLike && <div className="node-summary slim"><span>{data.category}</span><span>{routeLabel[routeState]}</span><span>{lowLevel ? 'Низкий уровень' : `${Math.round(Math.max(level, 0))}% объёма`}</span><span>{heatingOn ? 'Нагрев вкл' : agitatorOn ? 'Перемешивание' : String(process.activityLabel ?? 'Контур готов')}</span></div>}
      {showInlineInspectorMeta && <div className="node-summary inline-summary"><span>{data.category}</span><span>{routeLabel[routeState]}</span><span>{data.className === 'valve' ? (valveOpen ? 'Открыт' : 'Закрыт') : data.className === 'instrument' ? data.technicalTag : terminalNode ? 'Конечная точка' : `${flow} л/мин`}</span><span>{isAlarmed ? 'Тревога' : blockedState ? 'Блокировка' : 'Норма'}</span></div>}
      {handles.filter((handle) => handle.type === 'source').map((handle) => <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} className={handle.className} />)}
    </div>
  );
});
