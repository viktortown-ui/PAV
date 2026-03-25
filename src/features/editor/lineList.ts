import { ProjectDocument, Severity, SoapEdge, ValidationIssue } from '../../domain/schemas/types';

export interface SegmentListEntry {
  edgeId: string;
  segmentId: string;
  lineTag: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  nominalDiameter: string;
  mediumLabel: string;
  routeStateLabel: string;
  warningCount: number;
  issueCount: number;
  severity: Severity | 'ok';
}

export interface DiagnosticsSummary {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
}

const mediumLabelMap: Record<string, string> = {
  water: 'Вода',
  product: 'Продукт',
  cip: 'СИП',
  waste: 'Сток',
  composite: 'Смесь',
};

const routeStateLabelMap: Record<string, string> = {
  idle: 'Ожидание',
  primed: 'Подготовлен',
  flowing: 'Поток',
  blocked: 'Блокировка',
  starved: 'Нет подпитки',
  draining: 'Слив',
  cip: 'СИП',
  alarm: 'Авария',
  maintenance: 'Ремонт',
  offline: 'Отключён',
};

const severityRank: Record<Severity | 'ok', number> = { error: 3, warning: 2, info: 1, ok: 0 };

const pickSeverity = (issues: ValidationIssue[]): Severity | 'ok' => issues.reduce<Severity | 'ok'>((current, issue) => (
  severityRank[issue.severity] > severityRank[current] ? issue.severity : current
), 'ok');

const makeLineTag = (edge: SoapEdge, sourceName: string, targetName: string) => {
  const service = edge.data?.lineRole === 'CIP' ? 'СИП' : mediumLabelMap[edge.data?.medium ?? 'water']?.toUpperCase() ?? 'ЛИНИЯ';
  const sourceRef = edge.data?.upstreamRef ?? sourceName;
  const targetRef = edge.data?.downstreamRef ?? targetName;
  const diameter = edge.data?.nominalDiameter ?? 'DN50';
  return `${service} · ${sourceRef} → ${targetRef} · ${diameter}`;
};

export const buildSegmentList = (project: ProjectDocument, issues: ValidationIssue[]): SegmentListEntry[] => {
  const issueMap = new Map<string, ValidationIssue[]>();
  issues.forEach((issue) => {
    issue.edgeIds?.forEach((edgeId) => {
      issueMap.set(edgeId, [...(issueMap.get(edgeId) ?? []), issue]);
    });
  });

  return project.edges.map((edge) => {
    const source = project.nodes.find((node) => node.id === edge.source);
    const target = project.nodes.find((node) => node.id === edge.target);
    const relatedIssues = issueMap.get(edge.id) ?? [];
    const sourceName = source?.data.shortName ?? edge.source;
    const targetName = target?.data.shortName ?? edge.target;
    return {
      edgeId: edge.id,
      segmentId: edge.data?.segmentId ?? edge.id,
      lineTag: makeLineTag(edge, sourceName, targetName),
      sourceId: edge.source,
      targetId: edge.target,
      sourceName,
      targetName,
      nominalDiameter: edge.data?.nominalDiameter ?? 'DN50',
      mediumLabel: mediumLabelMap[edge.data?.medium ?? 'water'] ?? String(edge.data?.medium ?? 'water'),
      routeStateLabel: routeStateLabelMap[edge.data?.routeState ?? 'idle'] ?? String(edge.data?.routeState ?? 'idle'),
      warningCount: (edge.data?.routeWarnings ?? []).length,
      issueCount: relatedIssues.length,
      severity: pickSeverity(relatedIssues),
    };
  }).sort((a, b) => {
    const severityDiff = severityRank[b.severity] - severityRank[a.severity];
    if (severityDiff !== 0) return severityDiff;
    if (b.issueCount !== a.issueCount) return b.issueCount - a.issueCount;
    return a.lineTag.localeCompare(b.lineTag, 'ru');
  });
};

export const summarizeDiagnostics = (issues: ValidationIssue[]): DiagnosticsSummary => issues.reduce<DiagnosticsSummary>((acc, issue) => {
  acc.total += 1;
  if (issue.severity === 'error') acc.errors += 1;
  else if (issue.severity === 'warning') acc.warnings += 1;
  else acc.infos += 1;
  return acc;
}, { total: 0, errors: 0, warnings: 0, infos: 0 });
