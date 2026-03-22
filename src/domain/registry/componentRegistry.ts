import { ComponentDefinition, InspectorTab, PropertyField, SoapNodeKind } from '../schemas/types';

const select = (label: string, value: string) => ({ label, value });
const tabs = (...fields: PropertyField[]) => fields;

const commonMain = tabs(
  { key: 'visibleName', label: 'Название', type: 'text' },
  { key: 'shortName', label: 'Короткое имя', type: 'text' },
  { key: 'technicalTag', label: 'Технический тег', type: 'text' },
  { key: 'notes', label: 'Примечание', type: 'textarea' },
);

const commonProcess = tabs(
  { key: 'medium', label: 'Среда', type: 'select', options: [select('Вода', 'water'), select('Продукт', 'product'), select('CIP / промывка', 'cip'), select('Сток', 'waste')] },
  { key: 'capacity', label: 'Объём, л', type: 'number', min: 0, step: 10 },
  { key: 'level', label: 'Уровень, л', type: 'number', min: 0, step: 10 },
  { key: 'flowRate', label: 'Расход, л/мин', type: 'number', min: 0, step: 1 },
  { key: 'temperature', label: 'Температура, °C', type: 'number', step: 1 },
  { key: 'pressure', label: 'Давление, бар', type: 'number', step: 0.1 },
  { key: 'diameterNominal', label: 'Диаметр условный', type: 'text' },
  { key: 'activityLabel', label: 'Активность', type: 'text' },
);

const valveFields = tabs(
  { key: 'valveType', label: 'Тип', type: 'text' },
  { key: 'valveState', label: 'Состояние', type: 'select', options: [select('Открыт', 'open'), select('Закрыт', 'closed'), select('Регулирование', 'throttled')] },
  { key: 'valveMode', label: 'Ручной / авто', type: 'select', options: [select('Ручной', 'manual'), select('Авто', 'auto')] },
  { key: 'normallyOpen', label: 'Нормально открытый', type: 'toggle' },
  { key: 'failPosition', label: 'Аварийное положение', type: 'select', options: [select('Открыт', 'open'), select('Закрыт', 'closed'), select('Удержание', 'hold')] },
);

const sensorFields = tabs(
  { key: 'signalType', label: 'Тип сигнала', type: 'select', options: [select('Аналоговый', 'analogue'), select('Дискретный', 'digital'), select('Импульсный', 'pulse')] },
  { key: 'signalValue', label: 'Текущее значение', type: 'number', step: 0.1 },
  { key: 'signalUnit', label: 'Единица', type: 'text' },
  { key: 'warningLow', label: 'Порог предупреждения, нижний', type: 'number', step: 0.1 },
  { key: 'warningHigh', label: 'Порог предупреждения, верхний', type: 'number', step: 0.1 },
  { key: 'alarmLow', label: 'Порог аварии, нижний', type: 'number', step: 0.1 },
  { key: 'alarmHigh', label: 'Порог аварии, верхний', type: 'number', step: 0.1 },
);

const topologyFields = tabs(
  { key: 'junctionType', label: 'Тип соединения', type: 'text' },
  { key: 'allowedDirections', label: 'Допустимые направления', type: 'text' },
  { key: 'topologyMode', label: 'Режим', type: 'select', options: [select('Раздача', 'distribution'), select('Сбор', 'collection'), select('Смешение', 'mixing'), select('Дренаж', 'drain')] },
);

const appearanceFields = tabs(
  { key: 'accent', label: 'Акцентный цвет', type: 'text' },
  { key: 'fill', label: 'Заполнение, %', type: 'number', min: 0, max: 100, step: 1 },
  { key: 'showLabel', label: 'Показывать подпись', type: 'toggle' },
  { key: 'enabled', label: 'Элемент видим', type: 'toggle' },
);

const actionFields = tabs();

const simulationFields = tabs(
  { key: 'simEnabled', label: 'Участвует в симуляции', type: 'toggle' },
  { key: 'simActive', label: 'Форсировать активность', type: 'toggle' },
  { key: 'simFlow', label: 'Поток симуляции, л/мин', type: 'number', min: 0, step: 1 },
  { key: 'routeState', label: 'Состояние маршрута', type: 'select', options: [select('Ожидание', 'idle'), select('Подготовлен', 'primed'), select('Поток', 'flowing'), select('Блокировка', 'blocked'), select('Голодание', 'starved'), select('Слив', 'draining'), select('CIP', 'cip'), select('Авария', 'alarm'), select('Отключён', 'offline')] },
);

const makeDefinition = (
  type: SoapNodeKind,
  config: {
    label: string;
    shortName: string;
    technicalPrefix: string;
    category: string;
    description: string;
    className: ComponentDefinition['className'];
    accent: string;
    semanticSize: ComponentDefinition['defaults']['visual']['semanticSize'];
    ports?: { inputs: number; outputs: number; preferredDirection?: 'ltr' | 'ttb'; inline?: boolean };
    overrides?: Record<string, string | number | boolean>;
  },
): ComponentDefinition => {
  const baseFields: Record<InspectorTab, PropertyField[]> = {
    main: commonMain,
    process: commonProcess,
    ports: tabs(
      { key: 'inputs', label: 'Входов', type: 'number', min: 0, step: 1 },
      { key: 'outputs', label: 'Выходов', type: 'number', min: 0, step: 1 },
      { key: 'preferredDirection', label: 'Основное направление', type: 'select', options: [select('Слева направо', 'ltr'), select('Сверху вниз', 'ttb')] },
      { key: 'inline', label: 'Встраивается в линию', type: 'toggle' },
    ),
    signals: sensorFields,
    appearance: appearanceFields,
    alarms: valveFields,
    simulation: simulationFields,
    actions: actionFields,
  };

  if (config.className === 'topology') baseFields.process = topologyFields;
  else if (config.className === 'instrument') baseFields.process = sensorFields;
  else if (config.className === 'valve') baseFields.process = valveFields;

  const ports = config.ports ?? { inputs: 1, outputs: 1, preferredDirection: 'ltr', inline: false };

  return {
    type,
    label: config.label,
    shortName: config.shortName,
    technicalPrefix: config.technicalPrefix,
    category: config.category,
    description: config.description,
    className: config.className,
    defaults: {
      kind: type,
      status: 'idle',
      rotation: 0,
      mediumType: 'water',
      medium: 'water',
      mode: 'auto',
      alarms: [],
      isEnabled: true,
      isInteractive: true,
      simulationEnabled: true,
      notes: '',
      process: {
        capacity: 1000,
        level: 600,
        flowRate: 20,
        temperature: 22,
        pressure: 1.2,
        diameterNominal: 'DN50',
        activityLabel: 'В резерве',
        valveType: config.label,
        valveState: 'open',
        valveMode: 'manual',
        normallyOpen: true,
        failPosition: 'closed',
        signalType: 'analogue',
        signalValue: 0,
        signalUnit: 'л/мин',
        warningLow: 0,
        warningHigh: 0,
        alarmLow: 0,
        alarmHigh: 0,
        junctionType: config.label,
        allowedDirections: 'Вход/выход по схеме',
        topologyMode: 'distribution',
        pumpOn: type === 'pump' || type === 'dosingPump',
        valveOpen: true,
        mixingOn: type === 'reactor' || type === 'heatedReactor' || type === 'inlineMixer',
        heatingOn: type === 'heatedReactor',
        ...config.overrides,
      },
      visual: {
        accent: config.accent,
        fill: 45,
        enabled: true,
        semanticSize: config.semanticSize,
        showLabel: true,
      },
      ports: {
        inputs: ports.inputs,
        outputs: ports.outputs,
        preferredDirection: ports.preferredDirection ?? 'ltr',
        inline: ports.inline ?? false,
      },
      runtime: {
        enabled: true,
        active: false,
        blocked: false,
        routeState: 'idle',
        flow: Number(config.overrides?.flowRate ?? 0),
        flowLpm: Number(config.overrides?.flowRate ?? 0),
      },
      simulation: {
        enabled: true,
        active: false,
        blocked: false,
        routeState: 'idle',
        flow: Number(config.overrides?.flowRate ?? 0),
        flowLpm: Number(config.overrides?.flowRate ?? 0),
      },
    },
    fields: baseFields,
  };
};

export const componentRegistry: ComponentDefinition[] = [
  makeDefinition('source', { label: 'Источник воды', shortName: 'Источник', technicalPrefix: 'SRC', category: 'Источники', description: 'Подача исходной среды в схему.', className: 'major', accent: '#5bb9ff', semanticSize: 'major', ports: { inputs: 0, outputs: 1 }, overrides: { capacity: 5000, level: 5000, flowRate: 28, activityLabel: 'Подача' } }),
  makeDefinition('waterFilter', { label: 'Фильтр подготовки воды', shortName: 'Фильтр', technicalPrefix: 'WF', category: 'Подготовка воды', description: 'Предварительная очистка и стабилизация воды.', className: 'major', accent: '#84d59a', semanticSize: 'major' }),
  makeDefinition('roSkid', { label: 'Блок обратного осмоса', shortName: 'Осмос', technicalPrefix: 'RO', category: 'Подготовка воды', description: 'Узел мембранной подготовки воды.', className: 'major', accent: '#81d9ff', semanticSize: 'major', overrides: { pressure: 2.6, flowRate: 24 } }),
  makeDefinition('tank', { label: 'Технологическая ёмкость', shortName: 'Ёмкость', technicalPrefix: 'TK', category: 'Ёмкости', description: 'Основная технологическая ёмкость.', className: 'major', accent: '#64a6ff', semanticSize: 'major', overrides: { capacity: 3000, level: 2100 } }),
  makeDefinition('bufferTank', { label: 'Буферная ёмкость', shortName: 'Буфер', technicalPrefix: 'BT', category: 'Ёмкости', description: 'Буферный накопитель между стадиями.', className: 'major', accent: '#7199ff', semanticSize: 'major', overrides: { capacity: 2500, level: 1400 } }),
  makeDefinition('reactor', { label: 'Реактор', shortName: 'Реактор', technicalPrefix: 'R', category: 'Реакторы', description: 'Основной реакционный аппарат.', className: 'major', accent: '#bb8eff', semanticSize: 'major', overrides: { capacity: 2500, level: 1600, medium: 'product', activityLabel: 'Перемешивание' } }),
  makeDefinition('heatedReactor', { label: 'Реактор с нагревом', shortName: 'Нагреваемый реактор', technicalPrefix: 'HR', category: 'Реакторы', description: 'Реактор с тепловой рубашкой.', className: 'major', accent: '#f08ab7', semanticSize: 'major', overrides: { capacity: 2200, level: 1300, heatingOn: true, temperature: 48, medium: 'product' } }),
  makeDefinition('fillingStation', { label: 'Станция розлива', shortName: 'Розлив', technicalPrefix: 'FL', category: 'Потребители', description: 'Потребитель продукта на выходе.', className: 'major', accent: '#ff8ead', semanticSize: 'major', ports: { inputs: 1, outputs: 0 }, overrides: { medium: 'product' } }),
  makeDefinition('filterUnit', { label: 'Фильтрационный блок', shortName: 'Фильтр-блок', technicalPrefix: 'FU', category: 'Подготовка воды', description: 'Крупный фильтрационный агрегат.', className: 'major', accent: '#80dca1', semanticSize: 'major' }),
  makeDefinition('pump', { label: 'Насос', shortName: 'Насос', technicalPrefix: 'P', category: 'Насосы', description: 'Основной перекачивающий насос.', className: 'line', accent: '#ffb15a', semanticSize: 'line', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { flowRate: 32, pressure: 2.2, pumpOn: true } }),
  makeDefinition('dosingPump', { label: 'Дозировочный насос', shortName: 'Дозатор', technicalPrefix: 'DP', category: 'Насосы', description: 'Дозированная подача реагента.', className: 'line', accent: '#f8a55a', semanticSize: 'line', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { flowRate: 8, pressure: 3.2, pumpOn: true } }),
  makeDefinition('inlineFilter', { label: 'Линейный фильтр', shortName: 'Лин. фильтр', technicalPrefix: 'IF', category: 'Подготовка воды', description: 'Компактный фильтр на трубопроводе.', className: 'line', accent: '#84d59a', semanticSize: 'line', ports: { inputs: 1, outputs: 1, inline: true } }),
  makeDefinition('inlineMixer', { label: 'Линейный смеситель', shortName: 'Смеситель', technicalPrefix: 'MX', category: 'Реакторы', description: 'Встроенный смесительный элемент.', className: 'line', accent: '#d08fff', semanticSize: 'line', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { medium: 'product' } }),
  makeDefinition('heatExchanger', { label: 'Теплообменник', shortName: 'Теплообменник', technicalPrefix: 'E', category: 'Утилиты', description: 'Узел теплообмена на линии.', className: 'line', accent: '#ff9d86', semanticSize: 'line', ports: { inputs: 1, outputs: 1, inline: true } }),
  makeDefinition('manualValve', { label: 'Ручной клапан', shortName: 'Клапан', technicalPrefix: 'HV', category: 'Арматура', description: 'Ручная запорная арматура.', className: 'valve', accent: '#ffd36f', semanticSize: 'valve', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveMode: 'manual', valveType: 'Ручной клапан' } }),
  makeDefinition('shutoffValve', { label: 'Отсечной клапан', shortName: 'Отсечной', technicalPrefix: 'XV', category: 'Арматура', description: 'Быстрое отключение потока.', className: 'valve', accent: '#ffcf63', semanticSize: 'valve', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveType: 'Отсечной клапан' } }),
  makeDefinition('solenoidValve', { label: 'Соленоидный клапан', shortName: 'Соленоид', technicalPrefix: 'SV', category: 'Арматура', description: 'Электромагнитное управление потоком.', className: 'valve', accent: '#ffd06d', semanticSize: 'valve', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveMode: 'auto', valveType: 'Соленоидный клапан' } }),
  makeDefinition('checkValve', { label: 'Обратный клапан', shortName: 'Обратный', technicalPrefix: 'CV', category: 'Арматура', description: 'Защита от обратного потока.', className: 'valve', accent: '#f2db7b', semanticSize: 'valve', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveType: 'Обратный клапан', normallyOpen: true } }),
  makeDefinition('controlValve', { label: 'Регулирующий клапан', shortName: 'Регулир.', technicalPrefix: 'FV', category: 'Арматура', description: 'Плавное управление расходом.', className: 'valve', accent: '#f3c56c', semanticSize: 'valve', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveMode: 'auto', valveType: 'Регулирующий клапан', valveState: 'throttled' } }),
  makeDefinition('gateValve', { label: 'Задвижка', shortName: 'Задвижка', technicalPrefix: 'GV', category: 'Арматура', description: 'Линейная запорная задвижка.', className: 'valve', accent: '#e9c06c', semanticSize: 'valve', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveType: 'Задвижка' } }),
  makeDefinition('drainValve', { label: 'Дренажный клапан', shortName: 'Дренаж', technicalPrefix: 'DV', category: 'Арматура', description: 'Сброс в дренаж.', className: 'valve', accent: '#c9b36d', semanticSize: 'valve', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveType: 'Дренажный клапан', failPosition: 'open' } }),
  makeDefinition('reliefValve', { label: 'Предохранительный клапан', shortName: 'Предохран.', technicalPrefix: 'PSV', category: 'Арматура', description: 'Защита от превышения давления.', className: 'valve', accent: '#ffb27d', semanticSize: 'valve', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveType: 'Предохранительный клапан', failPosition: 'open' } }),
  makeDefinition('flowMeter', { label: 'Расходомер', shortName: 'Расходомер', technicalPrefix: 'FIT', category: 'КИП', description: 'Измерение расхода на линии.', className: 'instrument', accent: '#6edfc0', semanticSize: 'instrument', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 20, signalUnit: 'л/мин' } }),
  makeDefinition('pressureSensor', { label: 'Датчик давления', shortName: 'Давление', technicalPrefix: 'PIT', category: 'КИП', description: 'Контроль давления.', className: 'instrument', accent: '#79d3ff', semanticSize: 'instrument', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 1.6, signalUnit: 'бар' } }),
  makeDefinition('temperatureSensor', { label: 'Датчик температуры', shortName: 'Температура', technicalPrefix: 'TIT', category: 'КИП', description: 'Контроль температуры.', className: 'instrument', accent: '#ffa08a', semanticSize: 'instrument', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 22, signalUnit: '°C' } }),
  makeDefinition('levelSensor', { label: 'Датчик уровня', shortName: 'Уровень', technicalPrefix: 'LIT', category: 'КИП', description: 'Контроль уровня в аппарате.', className: 'instrument', accent: '#8ec5ff', semanticSize: 'instrument', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 65, signalUnit: '%' } }),
  makeDefinition('phSensor', { label: 'Датчик pH', shortName: 'pH', technicalPrefix: 'AIT', category: 'КИП', description: 'Контроль кислотности.', className: 'instrument', accent: '#86f0c2', semanticSize: 'instrument', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 7.2, signalUnit: 'pH' } }),
  makeDefinition('conductivitySensor', { label: 'Датчик проводимости', shortName: 'Проводим.', technicalPrefix: 'CIT', category: 'КИП', description: 'Контроль проводимости.', className: 'instrument', accent: '#98e4ff', semanticSize: 'instrument', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 125, signalUnit: 'мкСм/см' } }),
  makeDefinition('indicator', { label: 'Индикатор', shortName: 'Индикатор', technicalPrefix: 'I', category: 'КИП', description: 'Общий индикатор состояния.', className: 'instrument', accent: '#9de0c5', semanticSize: 'instrument', ports: { inputs: 1, outputs: 1, inline: true } }),
  makeDefinition('tee', { label: 'Тройник', shortName: 'Тройник', technicalPrefix: 'T', category: 'Трубные узлы', description: 'Узел ответвления на 3 направления.', className: 'topology', accent: '#b5c7df', semanticSize: 'topology', ports: { inputs: 1, outputs: 2, inline: true }, overrides: { topologyMode: 'distribution', junctionType: 'Тройник' } }),
  makeDefinition('cross', { label: 'Крестовина', shortName: 'Крестовина', technicalPrefix: 'X', category: 'Трубные узлы', description: 'Узел пересечения с четырьмя портами.', className: 'topology', accent: '#c3d3ea', semanticSize: 'topology', ports: { inputs: 2, outputs: 2, inline: true }, overrides: { topologyMode: 'distribution', junctionType: 'Крестовина' } }),
  makeDefinition('collector', { label: 'Коллектор', shortName: 'Коллектор', technicalPrefix: 'COL', category: 'Трубные узлы', description: 'Явный узел сбора нескольких линий.', className: 'topology', accent: '#a8c4db', semanticSize: 'topology', ports: { inputs: 2, outputs: 1, inline: true }, overrides: { topologyMode: 'collection', junctionType: 'Коллектор' } }),
  makeDefinition('splitter', { label: 'Раздаточный узел', shortName: 'Раздатчик', technicalPrefix: 'SPL', category: 'Трубные узлы', description: 'Явный узел раздачи потока.', className: 'topology', accent: '#a9c8e8', semanticSize: 'topology', ports: { inputs: 1, outputs: 2, inline: true }, overrides: { topologyMode: 'distribution', junctionType: 'Раздаточный узел' } }),
  makeDefinition('mixingJunction', { label: 'Смесительный узел', shortName: 'Смеситель', technicalPrefix: 'MXJ', category: 'Трубные узлы', description: 'Явный узел смешения потоков.', className: 'topology', accent: '#d8b8ff', semanticSize: 'topology', ports: { inputs: 2, outputs: 1, inline: true }, overrides: { topologyMode: 'mixing', junctionType: 'Смесительный узел' } }),
  makeDefinition('drainBranch', { label: 'Дренажное ответвление', shortName: 'Дренаж', technicalPrefix: 'DRB', category: 'Трубные узлы', description: 'Организованный отвод в дренаж.', className: 'topology', accent: '#9da8b8', semanticSize: 'topology', ports: { inputs: 1, outputs: 2, inline: true }, overrides: { topologyMode: 'drain', junctionType: 'Дренажное ответвление' } }),
  makeDefinition('samplePoint', { label: 'Точка отбора пробы', shortName: 'Проба', technicalPrefix: 'SP', category: 'Трубные узлы', description: 'Узел для отбора технологической пробы.', className: 'topology', accent: '#aed4c9', semanticSize: 'topology', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { topologyMode: 'distribution', junctionType: 'Точка отбора пробы' } }),
  makeDefinition('consumer', { label: 'Потребитель', shortName: 'Потребитель', technicalPrefix: 'CU', category: 'Потребители', description: 'Финальный потребитель среды.', className: 'major', accent: '#ff93a8', semanticSize: 'major', ports: { inputs: 1, outputs: 0 } }),
  makeDefinition('utilityDrain', { label: 'Дренажный коллектор', shortName: 'Дренаж', technicalPrefix: 'DR', category: 'Утилиты', description: 'Сбор и отвод в утиль.', className: 'major', accent: '#8793a8', semanticSize: 'major', ports: { inputs: 1, outputs: 0 }, overrides: { medium: 'waste', capacity: 0, level: 0, flowRate: 18 } }),
];

export const componentMap = new Map(componentRegistry.map((item) => [item.type, item]));
