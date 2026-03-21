import { ComponentDefinition, InspectorTab, PropertyField, SoapNodeKind } from '../schemas/types';

const select = (label: string, value: string) => ({ label, value });
const tabs = (...fields: PropertyField[]) => fields;

const commonMain = tabs(
  { key: 'label', label: 'Наименование', type: 'text' },
  { key: 'shortName', label: 'Короткое имя', type: 'text' },
  { key: 'tag', label: 'Тег', type: 'text' },
  { key: 'description', label: 'Описание', type: 'textarea' },
);
const commonProcess = tabs(
  { key: 'medium', label: 'Среда', type: 'select', options: [select('Вода', 'water'), select('Продукт', 'product'), select('CIP / промывка', 'cip'), select('Сток', 'waste')] },
  { key: 'capacity', label: 'Объём, л', type: 'number', min: 0, step: 10 },
  { key: 'level', label: 'Текущий объём, л', type: 'number', min: 0, step: 10 },
  { key: 'flowRate', label: 'Расход, л/мин', type: 'number', min: 0, step: 1 },
  { key: 'temperature', label: 'Температура, °C', type: 'number', step: 1 },
  { key: 'pressure', label: 'Давление, бар', type: 'number', step: 0.1 },
  { key: 'rpm', label: 'Обороты, rpm', type: 'number', step: 10 },
  { key: 'valveOpen', label: 'Открыт', type: 'toggle' },
  { key: 'pumpOn', label: 'Насос включён', type: 'toggle' },
  { key: 'mixingOn', label: 'Перемешивание', type: 'toggle' },
  { key: 'heatingOn', label: 'Нагрев', type: 'toggle' },
);

const fieldSet = (kind: SoapNodeKind, label: string, shortName: string, category: string, accent: string, overrides: Record<string, number | string | boolean>, semanticSize: 'main' | 'inline' | 'instrument'): ComponentDefinition => {
  const portDefaults = kind === 'inlet' ? { inputs: 0, outputs: 1 } : kind === 'filling' || kind === 'drain' ? { inputs: 1, outputs: 0 } : { inputs: 1, outputs: 1 };
  const baseFields: Record<InspectorTab, PropertyField[]> = {
    main: commonMain,
    process: commonProcess,
    ports: tabs(
      { key: 'inputs', label: 'Входов', type: 'number', min: 0, step: 1 },
      { key: 'outputs', label: 'Выходов', type: 'number', min: 0, step: 1 },
      { key: 'direction', label: 'Направление', type: 'select', options: [select('Слева направо', 'ltr'), select('Сверху вниз', 'ttb')] },
    ),
    signals: tabs(
      { key: 'signalValue', label: 'Значение сигнала', type: 'number', step: 0.1 },
      { key: 'signalUnit', label: 'Единица', type: 'text' },
      { key: 'signalVisible', label: 'Показывать на схеме', type: 'toggle' },
    ),
    appearance: tabs(
      { key: 'accent', label: 'Акцентный цвет', type: 'text' },
      { key: 'fill', label: 'Уровень, %', type: 'number', min: 0, max: 100, step: 1 },
      { key: 'showLabel', label: 'Показывать подпись', type: 'toggle' },
      { key: 'enabled', label: 'Элемент видим', type: 'toggle' },
    ),
    alarms: tabs(
      { key: 'alarmText', label: 'Текст аварии', type: 'text' },
      { key: 'overflowAlarm', label: 'Контроль переполнения', type: 'toggle' },
      { key: 'dryRunWarning', label: 'Контроль сухого хода', type: 'toggle' },
      { key: 'failPosition', label: 'Аварийное положение', type: 'select', options: [select('Открыт', 'open'), select('Закрыт', 'closed')] },
    ),
    simulation: tabs(
      { key: 'simEnabled', label: 'Участвует в симуляции', type: 'toggle' },
      { key: 'simActive', label: 'Форсировать активность', type: 'toggle' },
      { key: 'simFlow', label: 'Поток симуляции, л/мин', type: 'number', min: 0, step: 1 },
      { key: 'routeState', label: 'Состояние маршрута', type: 'select', options: [select('Ожидание', 'idle'), select('Подготовлен', 'primed'), select('Поток', 'flowing'), select('Блокировка', 'blocked'), select('Голодание', 'starved'), select('Слив', 'draining'), select('CIP', 'cip'), select('Авария', 'alarm'), select('Отключён', 'offline')] },
    ),
  };

  return {
    type: kind,
    label,
    shortName,
    category,
    description: label,
    defaults: {
      kind,
      tag: kind.toUpperCase(),
      status: 'normal',
      rotation: 0,
      medium: (overrides.medium as any) ?? 'water',
      process: {
        capacity: 2000,
        level: 1000,
        flowRate: 20,
        temperature: 22,
        pressure: 1.2,
        rpm: 0,
        valveOpen: true,
        pumpOn: kind === 'pump',
        mixingOn: kind === 'reactor' || kind === 'heatedReactor',
        heatingOn: kind === 'heatedReactor',
        direction: 'ltr',
        signalValue: 0,
        signalUnit: 'л/мин',
        signalVisible: true,
        overflowAlarm: true,
        dryRunWarning: kind === 'pump',
        failPosition: 'closed',
        routeState: 'idle',
        ...overrides,
      },
      visual: {
        accent,
        fill: Number(overrides.capacity) ? (Number(overrides.level ?? 0) / Number(overrides.capacity)) * 100 : 0,
        enabled: true,
        semanticSize,
        showLabel: true,
      },
      ports: portDefaults,
      simulation: {
        enabled: true,
        active: false,
        blocked: false,
        routeState: 'idle',
        flow: Number(overrides.flowRate ?? 0),
      },
    },
    fields: baseFields,
  };
};

export const componentRegistry: ComponentDefinition[] = [
  fieldSet('inlet', 'Ввод сырой воды', 'Ввод', 'Источники', '#5bb9ff', { capacity: 5000, level: 5000, flowRate: 28, medium: 'water' }, 'main'),
  fieldSet('filter', 'Угольный фильтр', 'Фильтр', 'Подготовка воды', '#84d59a', { pressure: 1.8, medium: 'water' }, 'main'),
  fieldSet('ro', 'Блок обратного осмоса', 'RO', 'Подготовка воды', '#81d9ff', { pressure: 2.6, flowRate: 24, medium: 'water' }, 'main'),
  fieldSet('tank', 'Танк', 'Танк', 'Ёмкости', '#64a6ff', { capacity: 3000, level: 2100 }, 'main'),
  fieldSet('reactor', 'Реактор', 'Реактор', 'Реакторы', '#bb8eff', { capacity: 2500, level: 1600, rpm: 180, medium: 'product' }, 'main'),
  fieldSet('heatedReactor', 'Реактор с рубашкой', 'Нагр. реактор', 'Реакторы', '#f08ab7', { capacity: 2200, level: 1300, rpm: 220, heatingOn: true, temperature: 48, medium: 'product' }, 'main'),
  fieldSet('pump', 'Насос', 'Насос', 'Перекачка', '#ffb15a', { flowRate: 32, pressure: 2.2, pumpOn: true }, 'main'),
  fieldSet('valve', 'Клапан', 'XV', 'Арматура', '#ffd36f', { valveOpen: true, flowRate: 0 }, 'inline'),
  fieldSet('sensor', 'Датчик', 'FIT', 'КИП', '#6edfc0', { signalValue: 20, signalUnit: 'л/мин', flowRate: 0 }, 'instrument'),
  fieldSet('filling', 'Линия розлива', 'Розлив', 'Потребители', '#ff8ead', { capacity: 1200, level: 100, medium: 'product' }, 'main'),
  fieldSet('drain', 'Дренаж', 'Дренаж', 'Утилиты', '#8793a8', { capacity: 0, level: 0, flowRate: 18, medium: 'waste' }, 'main'),
];

export const componentMap = new Map(componentRegistry.map((item) => [item.type, item]));
