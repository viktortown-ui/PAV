import { ProjectDocument, Severity, SoapNode } from '../schemas/types';

export interface NodeCommandResult {
  project: ProjectDocument;
  changed: boolean;
  lastCommand?: string;
}

const limitLog = (project: ProjectDocument) => ({ ...project, eventLog: project.eventLog.slice(-80) });

const logEvent = (project: ProjectDocument, message: string, targetId?: string, severity: Severity = 'info', type = 'operation'): ProjectDocument => ({
  ...project,
  eventLog: [...project.eventLog, { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type, message, severity, targetId }],
});

const applyNodeCommand = (node: SoapNode, action: string) => {
  let eventMessage = '';
  let eventSeverity: Severity = 'info';
  const copy = structuredClone(node);
  const p: any = copy.data.process;
  const d: any = copy.data;
  const syncCommandState = () => {
    p.allowIntake = Boolean(p.allowIntake ?? p.canReceive ?? true);
    p.allowDischarge = Boolean(p.allowDischarge ?? p.canDischarge ?? true);
    p.isRunning = Boolean(p.isRunning ?? p.pumpOn ?? p.mixingOn ?? p.heatingOn ?? d.status === 'running');
    p.isBlocked = Boolean(p.isBlocked ?? false);
    p.processState = String(p.processState ?? 'idle');
    p.mode = String(p.mode ?? d.mode ?? 'auto');
    p.canReceive = p.allowIntake;
    p.canDischarge = p.allowDischarge;
  };
  syncCommandState();

  if (action === 'reactor:start') { d.status = 'running'; d.runtime.active = true; d.simulation.active = true; d.visual.enabled = true; d.isEnabled = true; d.runtime.enabled = true; d.simulation.enabled = true; p.isRunning = true; p.processState = 'running'; eventMessage = `${d.visibleName}: реактор включён.`; }
  else if (action === 'reactor:stop') { d.status = 'off'; d.runtime.active = false; d.simulation.active = false; d.visual.enabled = true; p.isRunning = false; p.processState = 'idle'; eventMessage = `${d.visibleName}: реактор остановлен.`; }
  else if (action === 'reactor:heatingOn') { p.heatingOn = true; eventMessage = `${d.visibleName}: нагрев включён.`; }
  else if (action === 'reactor:heatingOff') { p.heatingOn = false; eventMessage = `${d.visibleName}: нагрев выключен.`; }
  else if (action === 'reactor:agitatorOn') { p.agitatorOn = true; p.mixingOn = true; eventMessage = `${d.visibleName}: мешалка включена.`; }
  else if (action === 'reactor:agitatorOff') { p.agitatorOn = false; p.mixingOn = false; eventMessage = `${d.visibleName}: мешалка выключена.`; }
  else if (action === 'reactor:setIdle') { d.status = 'idle'; p.isRunning = false; p.processState = 'idle'; eventMessage = `${d.visibleName}: реактор переведён в ожидание.`; }
  else if (action === 'reactor:setMaintenance') { d.status = 'maintenance'; d.visual.enabled = false; p.isRunning = false; p.processState = 'fault'; eventMessage = `${d.visibleName}: реактор переведён в ремонт.`; eventSeverity = 'warning'; }
  else if (action === 'pump:start') { d.status = 'running'; d.visual.enabled = true; d.isEnabled = true; d.runtime.enabled = true; d.simulation.enabled = true; p.pumpOn = true; p.isRunning = true; p.processState = 'running'; p.actualFlowLpm = p.nominalFlowLpm ?? p.actualFlowLpm ?? p.flowRate; eventMessage = `${d.visibleName}: насос запущен.`; }
  else if (action === 'pump:stop') { d.status = 'off'; p.pumpOn = false; p.isRunning = false; p.processState = 'idle'; p.actualFlowLpm = 0; eventMessage = `${d.visibleName}: насос остановлен.`; }
  else if (action === 'pump:clearAlarm') { d.status = 'idle'; d.alarms = []; d.runtime.alarmText = ''; d.simulation.alarmText = ''; eventMessage = `${d.visibleName}: тревога насоса сброшена.`; }
  else if (action === 'valve:open') { p.isOpen = true; p.valveOpen = true; p.valveState = 'open'; p.isBlocked = false; p.processState = 'idle'; d.status = 'running'; eventMessage = `${d.visibleName}: клапан открыт.`; }
  else if (action === 'valve:close') { p.isOpen = false; p.valveOpen = false; p.valveState = 'closed'; p.isBlocked = true; p.processState = 'blocked'; d.status = 'blocked'; eventMessage = `${d.visibleName}: клапан закрыт.`; }
  else if (action === 'valve:auto') { d.mode = 'auto'; p.manualOverride = false; p.valveMode = 'auto'; eventMessage = `${d.visibleName}: клапан переведён в авто.`; }
  else if (action === 'valve:manual') { d.mode = 'manual'; p.manualOverride = true; p.valveMode = 'manual'; eventMessage = `${d.visibleName}: клапан переведён в ручной режим.`; }
  else if (action === 'tank:enableReceive') { p.allowIntake = true; p.canReceive = true; eventMessage = `${d.visibleName}: приём разрешён.`; }
  else if (action === 'tank:disableReceive') { p.allowIntake = false; p.canReceive = false; p.processState = 'blocked'; eventMessage = `${d.visibleName}: приём запрещён.`; eventSeverity = 'warning'; }
  else if (action === 'tank:enableDischarge') { p.allowDischarge = true; p.canDischarge = true; eventMessage = `${d.visibleName}: выдача разрешена.`; }
  else if (action === 'tank:disableDischarge') { p.allowDischarge = false; p.canDischarge = false; p.processState = 'blocked'; eventMessage = `${d.visibleName}: выдача запрещена.`; eventSeverity = 'warning'; }
  else if (action === 'station:enableIntake') { p.allowIntake = true; p.canReceive = true; p.processState = 'idle'; eventMessage = `${d.visibleName}: приём на станции разрешён.`; }
  else if (action === 'station:disableIntake') { p.allowIntake = false; p.canReceive = false; p.processState = 'blocked'; eventMessage = `${d.visibleName}: приём на станции запрещён.`; eventSeverity = 'warning'; }
  else if (action === 'sensor:clearWarning') { d.status = 'idle'; d.alarms = []; d.runtime.alarmText = ''; d.simulation.alarmText = ''; eventMessage = `${d.visibleName}: предупреждение снято.`; }
  else if (action === 'sensor:enable') { d.isEnabled = true; d.visual.enabled = true; d.simulation.enabled = true; d.runtime.enabled = true; p.isRunning = true; p.processState = 'idle'; eventMessage = `${d.visibleName}: контроль включён.`; }
  else if (action === 'sensor:disable') { d.isEnabled = false; d.visual.enabled = false; d.simulation.enabled = false; d.runtime.enabled = false; p.isRunning = false; p.processState = 'offline'; eventMessage = `${d.visibleName}: контроль выключен.`; eventSeverity = 'warning'; }

  if (!eventMessage) return { changed: false, node };
  d.updatedAt = new Date().toISOString();
  d.revision = Number(d.revision ?? 0) + 1;
  return { changed: true, node: copy, eventMessage, eventSeverity };
};

export const executeNodeCommand = (project: ProjectDocument, nodeId: string, action: string): NodeCommandResult => {
  let metadata: ReturnType<typeof applyNodeCommand> | undefined;
  const nextProject = {
    ...project,
    nodes: project.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      metadata = applyNodeCommand(node, action);
      return metadata.node;
    }),
  };

  if (!metadata?.changed || !metadata.eventMessage) return { project, changed: false };
  const loggedProject = logEvent({ ...nextProject, simulation: { ...nextProject.simulation, lastEvent: metadata.eventMessage } }, metadata.eventMessage, nodeId, metadata.eventSeverity);
  return { project: limitLog(loggedProject), changed: true, lastCommand: action };
};
