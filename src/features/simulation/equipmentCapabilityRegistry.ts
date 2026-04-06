import { SoapNodeKind } from '../../domain/schemas/types';

export type CapabilityAction =
  | 'startStop'
  | 'openClose'
  | 'autoManual'
  | 'isolate'
  | 'clearAlarm'
  | 'replaceEquipment'
  | 'jumpSource'
  | 'jumpTarget'
  | 'highlightRoute'
  | 'openDiagnostics';

export interface EquipmentCapabilityProfile {
  kind: SoapNodeKind;
  canStartStop: boolean;
  canOpenClose: boolean;
  supportsAutoManual: boolean;
  hasFlow: boolean;
  hasPressure: boolean;
  hasPosition: boolean;
  hasMeasurement: boolean;
  directActuation: boolean;
  actions: CapabilityAction[];
  diagnostics: string[];
  replaceFamily: 'vessel' | 'machinery' | 'valve' | 'instrument' | 'topology' | 'terminal';
}

const valveKinds: SoapNodeKind[] = ['manualValve', 'shutoffValve', 'solenoidValve', 'checkValve', 'controlValve', 'gateValve', 'drainValve', 'reliefValve'];
const sensorKinds: SoapNodeKind[] = ['flowMeter', 'pressureSensor', 'temperatureSensor', 'levelSensor', 'phSensor', 'conductivitySensor', 'indicator'];
const pumpKinds: SoapNodeKind[] = ['pump', 'dosingPump'];
const vesselKinds: SoapNodeKind[] = ['tank', 'bufferTank', 'reactor', 'heatedReactor', 'waterFilter', 'roSkid', 'filterUnit', 'fillingStation'];

const make = (kind: SoapNodeKind): EquipmentCapabilityProfile => {
  const isValve = valveKinds.includes(kind);
  const isSensor = sensorKinds.includes(kind);
  const isPump = pumpKinds.includes(kind);
  const isVessel = vesselKinds.includes(kind);
  const isTerminal = ['source', 'consumer', 'utilityDrain', 'offPageConnector', 'serviceTerminal', 'samplePoint', 'drainBranch'].includes(kind);

  return {
    kind,
    canStartStop: isPump || ['reactor', 'heatedReactor', 'fillingStation', 'inlineMixer', 'heatExchanger'].includes(kind),
    canOpenClose: isValve,
    supportsAutoManual: isValve || isPump,
    hasFlow: isPump || kind === 'flowMeter' || kind === 'inlineFilter' || kind === 'heatExchanger',
    hasPressure: isPump || kind === 'pressureSensor' || kind === 'heatExchanger',
    hasPosition: isValve,
    hasMeasurement: isSensor,
    directActuation: !isSensor,
    actions: [
      ...(isPump ? ['startStop'] : []),
      ...(isValve ? ['openClose'] : []),
      ...((isValve || isPump) ? ['autoManual'] : []),
      ...(!isSensor ? ['isolate'] : []),
      'clearAlarm',
      'replaceEquipment',
      'jumpSource',
      'jumpTarget',
      'highlightRoute',
      'openDiagnostics',
    ] as CapabilityAction[],
    diagnostics: isSensor
      ? ['signal', 'calibration', 'communication']
      : isValve
        ? ['interlock', 'position', 'fail-state']
        : isPump
          ? ['motor', 'dry-run', 'head-limit']
          : isVessel
            ? ['level', 'temperature', 'overflow']
            : ['connectivity', 'topology'],
    replaceFamily: isValve ? 'valve' : isPump ? 'machinery' : isSensor ? 'instrument' : isVessel ? 'vessel' : isTerminal ? 'terminal' : 'topology',
  };
};

const allKinds: SoapNodeKind[] = [
  'source', 'waterFilter', 'roSkid', 'tank', 'bufferTank', 'reactor', 'heatedReactor', 'fillingStation', 'filterUnit',
  'pump', 'dosingPump', 'inlineFilter', 'inlineMixer', 'heatExchanger',
  'manualValve', 'shutoffValve', 'solenoidValve', 'checkValve', 'controlValve', 'gateValve', 'drainValve', 'reliefValve',
  'flowMeter', 'pressureSensor', 'temperatureSensor', 'levelSensor', 'phSensor', 'conductivitySensor', 'indicator',
  'tee', 'cross', 'collector', 'splitter', 'mixingJunction', 'drainBranch', 'samplePoint', 'consumer', 'utilityDrain', 'offPageConnector', 'serviceTerminal',
];

export const equipmentCapabilityRegistry = new Map(allKinds.map((kind) => [kind, make(kind)]));
export const getEquipmentCapability = (kind: SoapNodeKind) => equipmentCapabilityRegistry.get(kind) ?? make(kind);
