import { ComponentDefinition, PropertyField, SoapNodeKind } from '../schemas/types';

const baseFields: { general: PropertyField[]; process: PropertyField[]; visual: PropertyField[]; simulation: PropertyField[] } = {
  general: [
    { key: 'label', label: 'Имя', type: 'text' },
    { key: 'tag', label: 'Тег', type: 'text' },
    { key: 'description', label: 'Заметки', type: 'textarea' },
  ],
  process: [
    { key: 'capacity', label: 'Объём, л', type: 'number', min: 0, step: 10 },
    { key: 'level', label: 'Текущий объём, л', type: 'number', min: 0, step: 10 },
    { key: 'flowRate', label: 'Расход, л/мин', type: 'number', min: 0, step: 1 },
    { key: 'temperature', label: 'Температура, °C', type: 'number', step: 1 },
    { key: 'pressure', label: 'Давление, бар', type: 'number', step: 0.1 },
    { key: 'rpm', label: 'Обороты, rpm', type: 'number', step: 10 },
    { key: 'valveOpen', label: 'Клапан открыт', type: 'toggle' },
  ],
  visual: [
    { key: 'accent', label: 'Акцент', type: 'text' },
    { key: 'fill', label: 'Заполнение %', type: 'number', min: 0, max: 100, step: 1 },
    { key: 'enabled', label: 'Видимость', type: 'toggle' },
    { key: 'mixing', label: 'Мешалка', type: 'toggle' },
  ],
  simulation: [
    { key: 'simEnabled', label: 'Участвует', type: 'toggle' },
    { key: 'simActive', label: 'Активен', type: 'toggle' },
    { key: 'simFlow', label: 'Поток', type: 'number', min: 0, step: 1 },
  ],
};

const makeDef = (
  type: SoapNodeKind,
  label: string,
  category: string,
  accent: string,
  process: Record<string, number | string | boolean>,
): ComponentDefinition => ({
  type,
  label,
  category,
  description: label,
  defaults: {
    tag: type.toUpperCase(),
    status: 'normal',
    alarm: '',
    rotation: 0,
    process: {
      capacity: 1000,
      level: 600,
      flowRate: 18,
      temperature: 24,
      pressure: 1.2,
      rpm: 0,
      valveOpen: true,
      ...process,
    },
    visual: {
      accent,
      fill: 60,
      enabled: true,
      mixing: type === 'reactor',
    },
    ports: {
      inputs: type === 'inlet' ? 0 : 1,
      outputs: type === 'filling' ? 0 : 1,
    },
    simulation: {
      enabled: true,
      active: false,
      flow: Number(process.flowRate ?? 0),
      blocked: false,
    },
  },
  fields: baseFields,
});

export const componentRegistry: ComponentDefinition[] = [
  makeDef('inlet', 'Вход сырой воды', 'Подготовка воды', '#51b6ff', { capacity: 5000, level: 5000 }),
  makeDef('filter', 'Угольный фильтр', 'Подготовка воды', '#7ae582', { pressure: 1.8 }),
  makeDef('ro', 'Обратный осмос', 'Подготовка воды', '#8ee3f5', { pressure: 2.4 }),
  makeDef('tank', 'Танк чистой воды', 'Ёмкости и процесс', '#4eb1ff', { capacity: 3000, level: 1800 }),
  makeDef('reactor', 'Реактор с мешалкой', 'Ёмкости и процесс', '#b58cff', { capacity: 2500, level: 1200, rpm: 220 }),
  makeDef('pump', 'Трансферный насос', 'Перекачка', '#ffb84d', { pressure: 2.2, flowRate: 24 }),
  makeDef('valve', 'Клапан', 'Арматура', '#ffd166', { valveOpen: true, flowRate: 20 }),
  makeDef('sensor', 'Датчик расхода', 'Датчики', '#78f0c8', { threshold: 20, flowRate: 20 }),
  makeDef('filling', 'Линия розлива', 'Финишинг', '#ff8fab', { capacity: 1000, level: 0, flowRate: 16 }),
  makeDef('utility', 'Дренаж', 'Утилиты', '#93a4bf', { capacity: 0, level: 0, flowRate: 8 }),
];

export const componentMap = new Map(componentRegistry.map((item) => [item.type, item]));
