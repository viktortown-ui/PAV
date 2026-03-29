import { EventLogEntry, Severity } from '../../domain/schemas/types';

const EVENT_TYPE_LABEL: Record<string, string> = {
  editor: 'Команда',
  operation: 'Команда',
  simulation: 'Симуляция',
  physics: 'Физика',
  route: 'Маршрут',
  warning: 'Предупреждение',
  alarm: 'Авария',
  template: 'Симуляция',
};

const trimType = (value: string) => value.split('.')[0]?.trim().toLowerCase() || 'event';

const cleanupMessage = (message: string): string => {
  const normalized = message
    .replace(/\.simulation\b/gi, '')
    .replace(/\.physics\b/gi, '')
    .replace(/\.alarm\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!normalized) return '';

  if (/Cavitation risk check is a placeholder/i.test(normalized)) {
    return 'Проверка кавитационного риска пока упрощённая: оценка NPSH ещё не полная.';
  }
  if (/Steady-state solver currently supports series hydraulic chains/i.test(normalized)) {
    return 'Расчёт потока пока поддерживает только последовательные участки без разветвлений.';
  }

  const cleaned = normalized
    .replace(/\bbroken route\b/gi, 'маршрут разорван')
    .replace(/\bdownstream\b/gi, 'далее по линии')
    .replace(/\bupstream\b/gi, 'выше по линии')
    .replace(/\bEdge\s+([\w-]+)\s+produced\s+negative\s+flow[^.]*\.?/gi, 'Обратный поток на сегменте $1 запрещён настройками направления.')
    .replace(/\bEdge\s+([\w-]+)\s+has\s+unrealistic\s+velocity\s+([\d.,]+)\s*m\/s\.?/gi, 'Скорость на сегменте $1 слишком высокая ($2 м/с).')
    .replace(/\bInvalid hydraulic network\b/gi, 'Некорректная гидравлическая сеть')
    .replace(/\bTank\s+([\w-]+)\s+reached\s+max volume limit\.?/gi, 'Резервуар $1 достиг верхнего предела объёма.')
    .replace(/\bTank\s+([\w-]+)\s+reached\s+min volume limit\.?/gi, 'Резервуар $1 достиг нижнего предела объёма.')
    .replace(/\bTank\s+([\w-]+)\s+has impossible fill state: positive net inflow while already full\.?/gi, 'Резервуар $1 заполнен: приток есть, но объём уже на пределе.')
    .replace(/\bTank\s+([\w-]+)\s+has impossible drain state: negative net inflow while already empty\.?/gi, 'Резервуар $1 пуст: отток продолжается при нулевом объёме.')
    .replace(/\bTank\s+([\w-]+)\s+has inconsistent fill\/drain timing state\.?/gi, 'Резервуар $1: несогласованное состояние наполнения и слива.')
    .replace(/\bplaceholder\b/gi, 'упрощённая проверка')
    .replace(/\broute\b/gi, 'маршрут')
    .replace(/\bflow\b/gi, 'поток')
    .replace(/\bblocked\b/gi, 'заблокирован')
    .trim();

  if (/[A-Za-z]{3,}/.test(cleaned)) return '';
  return cleaned;
};

export const presentEvent = (event: EventLogEntry): EventLogEntry & { uiType: string; uiMessage: string } => {
  const normalizedType = trimType(event.type);
  const uiType = EVENT_TYPE_LABEL[normalizedType] ?? 'Симуляция';
  const uiMessage = cleanupMessage(event.message);
  return { ...event, type: normalizedType, uiType, uiMessage };
};

export const compactEvents = (events: EventLogEntry[]) => {
  const prepared = events.map((event) => presentEvent(event)).filter((event) => event.uiMessage);
  return prepared.filter((event, index, arr) => {
    const previous = arr[index - 1];
    return !(previous && previous.uiType === event.uiType && previous.uiMessage === event.uiMessage);
  });
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
