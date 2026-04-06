import { SoapNodeKind } from '../../domain/schemas/types';
import { getEquipmentCapability } from './equipmentCapabilityRegistry';

export interface ReplaceValidationResult {
  compatible: boolean;
  reasons: string[];
  canTransferPorts: boolean;
  canTransferParameters: boolean;
}

const canPortBridge = (from: SoapNodeKind, to: SoapNodeKind) => {
  const fromCap = getEquipmentCapability(from);
  const toCap = getEquipmentCapability(to);
  return fromCap.replaceFamily === toCap.replaceFamily;
};

export const validateReplacement = (from: SoapNodeKind, to: SoapNodeKind): ReplaceValidationResult => {
  const fromCap = getEquipmentCapability(from);
  const toCap = getEquipmentCapability(to);
  const reasons: string[] = [];

  if (from === to) reasons.push('Выбран тот же тип оборудования.');
  if (fromCap.replaceFamily !== toCap.replaceFamily) reasons.push('Несовместим класс оборудования для безопасной замены.');
  if (fromCap.canOpenClose !== toCap.canOpenClose) reasons.push('Отличается логика арматуры.');
  if (fromCap.canStartStop !== toCap.canStartStop) reasons.push('Отличается исполнительная механика.');

  return {
    compatible: reasons.length === 0,
    reasons,
    canTransferPorts: canPortBridge(from, to),
    canTransferParameters: fromCap.hasFlow === toCap.hasFlow || fromCap.hasMeasurement === toCap.hasMeasurement,
  };
};
