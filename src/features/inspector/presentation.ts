import { EventLogEntry, Severity } from '../../domain/schemas/types';

const EVENT_TYPE_LABEL: Record<string, string> = {
  editor: 'Команда',
  simulation: 'Симуляция',
  physics: 'Физика',
  route: 'Маршрут',
  warning: 'Предупреждение',
  alarm: 'Авария',
  template: 'Шаблон',
};

const trimType = (value: string) => value.split('.')[0]?.trim().toLowerCase() || 'event';

const cleanupMessage = (message: string): string => {
  const normalized = message
    .replace(/\.simulation\b/gi, '')
    .replace(/\.physics\b/gi, '')
    .replace(/\.alarm\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!normalized) return 'Событие зафиксировано.';

  if (/Cavitation risk check is a placeholder/i.test(normalized)) {
    return 'Проверка кавитационного риска пока упрощённая: оценка NPSH ещё не полная.';
  }
  if (/Steady-state solver currently supports series hydraulic chains/i.test(normalized)) {
    return 'Расчёт потока пока поддерживает только последовательные участки без разветвлений.';
  }

  return normalized
    .replace(/\bbroken route\b/gi, 'маршрут разорван')
    .replace(/\bdownstream\b/gi, 'далее по линии')
    .replace(/\bEdge\s+([\w-]+)\s+produced\s+negative\s+flow[^.]*\.?/gi, 'Обратный поток на сегменте $1 запрещён настройками направления.')
    .replace(/\bEdge\s+([\w-]+)\s+has\s+unrealistic\s+velocity\s+([\d.,]+)\s*m\/s\.?/gi, 'Скорость на сегменте $1 слишком высокая ($2 м/с).')
    .replace(/\bInvalid hydraulic network\b/gi, 'Некорректная гидравлическая сеть')
    .trim();
};

export const presentEvent = (event: EventLogEntry): EventLogEntry & { uiType: string; uiMessage: string } => {
  const normalizedType = trimType(event.type);
  const uiType = EVENT_TYPE_LABEL[normalizedType] ?? 'Событие';
  const uiMessage = cleanupMessage(event.message);
  return { ...event, type: normalizedType, uiType, uiMessage };
};

export const formatEventTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
});

export const severityTitle = (severity: Severity): string => {
  if (severity === 'error') return 'Ошибка';
  if (severity === 'warning') return 'Предупреждение';
  return 'Инфо';
};

export const formatSmartNumber = (value: number, digits: number, fallback = '—'): string => {
  if (!Number.isFinite(value)) return fallback;
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: digits });
};
