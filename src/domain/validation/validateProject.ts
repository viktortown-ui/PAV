import { ProjectDocument, ValidationIssue } from '../schemas/types';

export const validateProject = (project: ProjectDocument): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  project.edges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
  });

  project.nodes.forEach((node) => {
    const inCount = incoming.get(node.id) ?? 0;
    const outCount = outgoing.get(node.id) ?? 0;
    if (node.data.kind === 'inlet' && outCount === 0) issues.push({ id: `source-${node.id}`, severity: 'warning', message: `Источник «${node.data.label}» не имеет выходящей линии.`, nodeIds: [node.id] });
    if ((node.data.kind === 'filling' || node.data.kind === 'drain') && inCount === 0) issues.push({ id: `sink-${node.id}`, severity: 'warning', message: `Приёмник «${node.data.label}» не подключён по входу.`, nodeIds: [node.id] });
    if (!['inlet', 'filling', 'drain'].includes(node.data.kind) && inCount + outCount === 0) issues.push({ id: `isolated-${node.id}`, severity: 'error', message: `Элемент «${node.data.label}» не подключён к процессу.`, nodeIds: [node.id] });
    if (node.data.kind === 'valve' && inCount + outCount < 2) issues.push({ id: `valve-${node.id}`, severity: 'error', message: `Клапан «${node.data.label}» должен стоять на реальной линии.`, nodeIds: [node.id] });
    if (node.data.kind === 'sensor' && inCount + outCount === 0) issues.push({ id: `sensor-${node.id}`, severity: 'warning', message: `Датчик «${node.data.label}» не привязан к линии или оборудованию.`, nodeIds: [node.id] });
  });

  project.edges.forEach((edge) => {
    const src = project.nodes.find((node) => node.id === edge.source);
    const dst = project.nodes.find((node) => node.id === edge.target);
    if (!src || !dst) {
      issues.push({ id: `dangling-${edge.id}`, severity: 'error', message: `Линия ${edge.id} потеряла источник или приёмник.`, edgeIds: [edge.id] });
      return;
    }
    if (src.position.x > dst.position.x + 120) issues.push({ id: `direction-${edge.id}`, severity: 'info', message: `Линия «${src.data.shortName} → ${dst.data.shortName}» идёт против основной оси и может ухудшать читаемость.`, edgeIds: [edge.id] });
  });

  return issues;
};
