import { ComponentDefinition, DirectionPolicy, EquipmentClass, InspectorTab, MediaGroup, PortRole, PropertyField, SoapNodeKind, SymbolFamily } from '../schemas/types';

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

const simulationFields = tabs(
  { key: 'simEnabled', label: 'Участвует в симуляции', type: 'toggle' },
  { key: 'simActive', label: 'Форсировать активность', type: 'toggle' },
  { key: 'simFlow', label: 'Поток симуляции, л/мин', type: 'number', min: 0, step: 1 },
  { key: 'routeState', label: 'Состояние маршрута', type: 'select', options: [select('Ожидание', 'idle'), select('Подготовлен', 'primed'), select('Поток', 'flowing'), select('Блокировка', 'blocked'), select('Голодание', 'starved'), select('Слив', 'draining'), select('CIP', 'cip'), select('Авария', 'alarm'), select('Ремонт', 'maintenance'), select('Отключён', 'offline')] },
);


const inferMediaGroup = (type: SoapNodeKind): MediaGroup => {
  if (type === 'utilityDrain' || type === 'drainBranch' || type === 'drainValve') return 'waste';
  if (type === 'serviceTerminal') return 'utility';
  if (type === 'source' || type === 'waterFilter' || type === 'roSkid') return 'water';
  if (type === 'mixingJunction' || type === 'inlineMixer' || type === 'reactor' || type === 'heatedReactor') return 'any';
  return 'product';
};

const makePortDetails = (type: SoapNodeKind, ports: { inputs: number; outputs: number; preferredDirection?: 'ltr' | 'ttb'; inline?: boolean }) => {
  const mediaGroup = inferMediaGroup(type);
  const details: Record<string, { portRole: PortRole; occupied: 'free'; mediaGroup: MediaGroup; allowMixing: boolean }> = {};
  if (ports.inputs > 0 || ['tee', 'splitter', 'cross', 'collector', 'mixingJunction', 'drainBranch', 'samplePoint'].includes(type)) {
    details['in-left'] = { portRole: 'inlet', occupied: 'free', mediaGroup, allowMixing: type === 'mixingJunction' };
  }
  if (ports.outputs > 0 || ['tee', 'splitter', 'cross', 'collector', 'mixingJunction', 'drainBranch', 'samplePoint'].includes(type)) {
    details['out-right'] = { portRole: ['tee', 'splitter', 'drainBranch'].includes(type) ? 'branch' : 'outlet', occupied: 'free', mediaGroup, allowMixing: type === 'mixingJunction' };
  }
  if (['tee', 'splitter', 'cross', 'drainBranch', 'samplePoint'].includes(type)) details['out-top'] = { portRole: 'branch', occupied: 'free', mediaGroup: type === 'drainBranch' ? 'waste' : mediaGroup, allowMixing: false };
  if (['collector', 'mixingJunction'].includes(type)) details['in-top'] = { portRole: 'branch', occupied: 'free', mediaGroup, allowMixing: type === 'mixingJunction' };
  if (type === 'cross') details['in-bottom'] = { portRole: 'branch', occupied: 'free', mediaGroup, allowMixing: false };
  return details;
};

const topologyPolicy = (type: SoapNodeKind): DirectionPolicy => {
  if (type === 'collector') return 'routeDriven';
  if (type === 'mixingJunction') return 'bidirectional';
  if (type === 'cross') return 'bidirectional';
  return 'inherited';
};

const familyLabelMap: Record<SymbolFamily, string> = {
  vessel: 'Крупное оборудование',
  machinery: 'Линейная машина',
  valve: 'Запорная арматура',
  instrument: 'Прибор / индикатор',
  topology: 'Топологический узел',
  terminal: 'Терминал / отвод',
};

type DefinitionConfig = {
  label: string;
  shortName: string;
  technicalPrefix: string;
  category: string;
  description: string;
  className: EquipmentClass;
  family: SymbolFamily;
  accent: string;
  semanticSize: ComponentDefinition['defaults']['visual']['semanticSize'];
  ruDescriptionShort: string;
  placementNote?: string;
  auditNote: string;
  ports?: { inputs: number; outputs: number; preferredDirection?: 'ltr' | 'ttb'; inline?: boolean };
  overrides?: Record<string, string | number | boolean>;
};

const makeDefinition = (type: SoapNodeKind, config: DefinitionConfig): ComponentDefinition => {
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
    actions: tabs(),
  };

  if (config.className === 'topology' || config.className === 'terminal') baseFields.process = topologyFields;
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
    family: config.family,
    familyLabel: familyLabelMap[config.family],
    ruDescriptionShort: config.ruDescriptionShort,
    placementNote: config.placementNote,
    auditNote: config.auditNote,
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
        mixingAllowed: type === 'mixingJunction',
        splitAllowed: ['tee', 'splitter', 'cross', 'drainBranch'].includes(type),
        mergeAllowed: ['collector', 'mixingJunction', 'cross'].includes(type),
        branchPriority: type === 'drainBranch' ? -1 : type === 'mixingJunction' ? 2 : 1,
        directionPolicy: topologyPolicy(type),
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
        details: makePortDetails(type, ports),
      },
      runtime: { enabled: true, active: false, blocked: false, routeState: 'idle', flow: Number(config.overrides?.flowRate ?? 0), flowLpm: Number(config.overrides?.flowRate ?? 0) },
      simulation: { enabled: true, active: false, blocked: false, routeState: 'idle', flow: Number(config.overrides?.flowRate ?? 0), flowLpm: Number(config.overrides?.flowRate ?? 0) },
    },
    fields: baseFields,
  };
};

export const componentRegistry: ComponentDefinition[] = [
  makeDefinition('source', { label: 'Источник воды', shortName: 'Источник', technicalPrefix: 'SRC', category: 'A. Основные аппараты', description: 'Подача исходной среды в схему.', className: 'major', family: 'vessel', accent: '#5bb9ff', semanticSize: 'major', ruDescriptionShort: 'Точка ввода исходной среды в установку.', placementNote: 'Ставится в начале технологической цепочки.', auditNote: 'Ранее язык источника был слишком близок к насосу и терминалу.', ports: { inputs: 0, outputs: 1 }, overrides: { capacity: 5000, level: 5000, flowRate: 28, activityLabel: 'Подача' } }),
  makeDefinition('waterFilter', { label: 'Фильтр подготовки воды', shortName: 'Фильтр', technicalPrefix: 'WF', category: 'A. Основные аппараты', description: 'Предварительная очистка и стабилизация воды.', className: 'major', family: 'vessel', accent: '#84d59a', semanticSize: 'major', ruDescriptionShort: 'Крупный блок подготовки воды.', placementNote: 'Обычно между источником и мембранными/ёмкостными стадиями.', auditNote: 'Ранее использовал тот же силуэт, что и линейный фильтр.' }),
  makeDefinition('roSkid', { label: 'Блок обратного осмоса', shortName: 'Осмос', technicalPrefix: 'RO', category: 'A. Основные аппараты', description: 'Узел мембранной подготовки воды.', className: 'major', family: 'vessel', accent: '#81d9ff', semanticSize: 'major', ruDescriptionShort: 'Мембранный аппаратный блок.', placementNote: 'После предочистки, до накопительных ёмкостей.', auditNote: 'Ранее считывался как произвольный прямоугольный модуль.', overrides: { pressure: 2.6, flowRate: 24 } }),
  makeDefinition('tank', { label: 'Технологическая ёмкость', shortName: 'Ёмкость', technicalPrefix: 'TK', category: 'A. Основные аппараты', description: 'Основная технологическая ёмкость.', className: 'major', family: 'vessel', accent: '#64a6ff', semanticSize: 'major', ruDescriptionShort: 'Вертикальная ёмкость хранения/буфера.', placementNote: 'Для накопления, выдержки и подачи.', auditNote: 'Ёмкости и клапаны должны быть разведены по силуэту.', overrides: { capacity: 3000, level: 2100 } }),
  makeDefinition('bufferTank', { label: 'Буферная ёмкость', shortName: 'Буфер', technicalPrefix: 'BT', category: 'A. Основные аппараты', description: 'Буферный накопитель между стадиями.', className: 'major', family: 'vessel', accent: '#7199ff', semanticSize: 'major', ruDescriptionShort: 'Накопительная межоперационная ёмкость.', placementNote: 'Между основными стадиями линии.', auditNote: 'Ранее визуально почти не отличалась от обычной ёмкости.', overrides: { capacity: 2500, level: 1400 } }),
  makeDefinition('reactor', { label: 'Реактор', shortName: 'Реактор', technicalPrefix: 'R', category: 'A. Основные аппараты', description: 'Основной реакционный аппарат.', className: 'major', family: 'vessel', accent: '#bb8eff', semanticSize: 'major', ruDescriptionShort: 'Аппарат реакционного/смесительного назначения.', placementNote: 'В основной производственной стадии.', auditNote: 'Реакторы нуждались в более инженерном отличии от обычных ёмкостей.', overrides: { capacity: 2500, level: 1600, medium: 'product', activityLabel: 'Перемешивание' } }),
  makeDefinition('heatedReactor', { label: 'Реактор с нагревом', shortName: 'Нагреваемый реактор', technicalPrefix: 'HR', category: 'A. Основные аппараты', description: 'Реактор с тепловой рубашкой.', className: 'major', family: 'vessel', accent: '#f08ab7', semanticSize: 'major', ruDescriptionShort: 'Реактор с рубашкой/нагревом.', placementNote: 'Там, где требуется термообработка.', auditNote: 'Ранее нагреваемый аппарат был почти тем же баком.', overrides: { capacity: 2200, level: 1300, heatingOn: true, temperature: 48, medium: 'product' } }),
  makeDefinition('fillingStation', { label: 'Станция розлива', shortName: 'Розлив', technicalPrefix: 'FL', category: 'A. Основные аппараты', description: 'Потребитель продукта на выходе.', className: 'major', family: 'vessel', accent: '#ff8ead', semanticSize: 'major', ruDescriptionShort: 'Конечная станция выдачи продукта.', placementNote: 'На выходе из производственной схемы.', auditNote: 'Конечный потребитель должен считываться как отдельный аппарат.', ports: { inputs: 1, outputs: 0 }, overrides: { medium: 'product' } }),
  makeDefinition('filterUnit', { label: 'Фильтрационный блок', shortName: 'Фильтр-блок', technicalPrefix: 'FU', category: 'A. Основные аппараты', description: 'Крупный фильтрационный агрегат.', className: 'major', family: 'vessel', accent: '#80dca1', semanticSize: 'major', ruDescriptionShort: 'Агрегатный фильтрационный модуль.', placementNote: 'Для автономных стадий фильтрации.', auditNote: 'Не должен повторять пиктограмму линейного фильтра.' }),
  makeDefinition('pump', { label: 'Насос', shortName: 'Насос', technicalPrefix: 'P', category: 'B. Насосы и inline-машины', description: 'Основной перекачивающий насос.', className: 'line', family: 'machinery', accent: '#ffb15a', semanticSize: 'line', ruDescriptionShort: 'Центробежный линейный насос.', placementNote: 'Встраивается в трубопровод между аппаратами.', auditNote: 'Насосы и датчики раньше были недостаточно разведены по языку.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { flowRate: 32, pressure: 2.2, pumpOn: true } }),
  makeDefinition('dosingPump', { label: 'Дозировочный насос', shortName: 'Дозатор', technicalPrefix: 'DP', category: 'B. Насосы и inline-машины', description: 'Дозированная подача реагента.', className: 'line', family: 'machinery', accent: '#f8a55a', semanticSize: 'line', ruDescriptionShort: 'Компактный дозировочный агрегат.', placementNote: 'На линиях ввода реагентов.', auditNote: 'Нужен отдельный образ от общего насоса и КИП.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { flowRate: 8, pressure: 3.2, pumpOn: true } }),
  makeDefinition('inlineFilter', { label: 'Линейный фильтр', shortName: 'Лин. фильтр', technicalPrefix: 'IF', category: 'B. Насосы и inline-машины', description: 'Компактный фильтр на трубопроводе.', className: 'line', family: 'machinery', accent: '#84d59a', semanticSize: 'line', ruDescriptionShort: 'Компактный трубный фильтрующий элемент.', placementNote: 'Непосредственно на линии.', auditNote: 'Ранее полностью делил язык с крупными фильтрами.', ports: { inputs: 1, outputs: 1, inline: true } }),
  makeDefinition('inlineMixer', { label: 'Линейный смеситель', shortName: 'Смеситель', technicalPrefix: 'MX', category: 'B. Насосы и inline-машины', description: 'Встроенный смесительный элемент.', className: 'line', family: 'machinery', accent: '#d08fff', semanticSize: 'line', ruDescriptionShort: 'Inline-смеситель для трубной секции.', placementNote: 'На участках интенсивного перемешивания.', auditNote: 'Должен выглядеть как трубная машина, а не как реактор.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { medium: 'product' } }),
  makeDefinition('heatExchanger', { label: 'Теплообменник', shortName: 'Теплообменник', technicalPrefix: 'E', category: 'B. Насосы и inline-машины', description: 'Узел теплообмена на линии.', className: 'line', family: 'machinery', accent: '#ff9d86', semanticSize: 'line', ruDescriptionShort: 'Линейный аппарат теплообмена.', placementNote: 'На греющих и охлаждающих петлях.', auditNote: 'Ранее имел общий дренажный силуэт с терминалом.', ports: { inputs: 1, outputs: 1, inline: true } }),
  makeDefinition('manualValve', { label: 'Ручной клапан', shortName: 'Клапан', technicalPrefix: 'HV', category: 'C. Арматура и отсечение', description: 'Ручная запорная арматура.', className: 'valve', family: 'valve', accent: '#ffd36f', semanticSize: 'valve', ruDescriptionShort: 'Ручное отсечение потока.', placementNote: 'На обслуживаемых изолируемых ветках.', auditNote: 'Все клапаны раньше были почти идентичны; теперь есть функциональные маркеры.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveMode: 'manual', valveType: 'Ручной клапан' } }),
  makeDefinition('shutoffValve', { label: 'Отсечной клапан', shortName: 'Отсечной', technicalPrefix: 'XV', category: 'C. Арматура и отсечение', description: 'Быстрое отключение потока.', className: 'valve', family: 'valve', accent: '#ffcf63', semanticSize: 'valve', ruDescriptionShort: 'Исполнительное быстрое отсечение.', placementNote: 'Перед критичными участками и потребителями.', auditNote: 'Клапан не должен читаться как мини-бак.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveType: 'Отсечной клапан' } }),
  makeDefinition('solenoidValve', { label: 'Соленоидный клапан', shortName: 'Соленоид', technicalPrefix: 'SV', category: 'C. Арматура и отсечение', description: 'Электромагнитное управление потоком.', className: 'valve', family: 'valve', accent: '#ffd06d', semanticSize: 'valve', ruDescriptionShort: 'Клапан с соленоидным приводом.', placementNote: 'На автоматических линиях малых диаметров.', auditNote: 'Нужен отличимый приводный знак без потери общего языка клапанов.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveMode: 'auto', valveType: 'Соленоидный клапан' } }),
  makeDefinition('checkValve', { label: 'Обратный клапан', shortName: 'Обратный', technicalPrefix: 'CV', category: 'C. Арматура и отсечение', description: 'Защита от обратного потока.', className: 'valve', family: 'valve', accent: '#f2db7b', semanticSize: 'valve', ruDescriptionShort: 'Односторонний пропуск потока.', placementNote: 'После насосов и на байпасах.', auditNote: 'Стрелочный маркер отличает функцию обратного хода.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveType: 'Обратный клапан', normallyOpen: true } }),
  makeDefinition('controlValve', { label: 'Регулирующий клапан', shortName: 'Регулир.', technicalPrefix: 'FV', category: 'C. Арматура и отсечение', description: 'Плавное управление расходом.', className: 'valve', family: 'valve', accent: '#f3c56c', semanticSize: 'valve', ruDescriptionShort: 'Регулирующий исполнительный клапан.', placementNote: 'На линиях управления расходом/давлением.', auditNote: 'Автоматический характер теперь читается отдельным знаком.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveMode: 'auto', valveType: 'Регулирующий клапан', valveState: 'throttled' } }),
  makeDefinition('gateValve', { label: 'Задвижка', shortName: 'Задвижка', technicalPrefix: 'GV', category: 'C. Арматура и отсечение', description: 'Линейная запорная задвижка.', className: 'valve', family: 'valve', accent: '#e9c06c', semanticSize: 'valve', ruDescriptionShort: 'Запорная задвижка для отсечения.', placementNote: 'На крупных трубопроводах и магистралях.', auditNote: 'Требовалось визуально отделить от общего ручного клапана.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveType: 'Задвижка' } }),
  makeDefinition('drainValve', { label: 'Дренажный клапан', shortName: 'Дренаж', technicalPrefix: 'DV', category: 'C. Арматура и отсечение', description: 'Сброс в дренаж.', className: 'valve', family: 'valve', accent: '#c9b36d', semanticSize: 'valve', ruDescriptionShort: 'Клапан для опорожнения и продувки.', placementNote: 'В нижних точках аппаратов и линий.', auditNote: 'Нужен отдельный дренажный хвост, а не общий ромб.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveType: 'Дренажный клапан', failPosition: 'open' } }),
  makeDefinition('reliefValve', { label: 'Предохранительный клапан', shortName: 'Предохран.', technicalPrefix: 'PSV', category: 'C. Арматура и отсечение', description: 'Защита от превышения давления.', className: 'valve', family: 'valve', accent: '#ffb27d', semanticSize: 'valve', ruDescriptionShort: 'Пружинная защита по давлению.', placementNote: 'На аппаратах и тупиковых объёмах под давлением.', auditNote: 'Функция сброса должна читаться явно, а не как обычный клапан.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { valveType: 'Предохранительный клапан', failPosition: 'open' } }),
  makeDefinition('flowMeter', { label: 'Расходомер', shortName: 'Расходомер', technicalPrefix: 'FIT', category: 'D. КИП и индикация', description: 'Измерение расхода на линии.', className: 'instrument', family: 'instrument', accent: '#6edfc0', semanticSize: 'instrument', ruDescriptionShort: 'Прибор контроля расхода.', placementNote: 'На прямолинейных участках трубопровода.', auditNote: 'Ранее все приборы имели одинаковый бейдж без смыслового штриха.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 20, signalUnit: 'л/мин' } }),
  makeDefinition('pressureSensor', { label: 'Датчик давления', shortName: 'Давление', technicalPrefix: 'PIT', category: 'D. КИП и индикация', description: 'Контроль давления.', className: 'instrument', family: 'instrument', accent: '#79d3ff', semanticSize: 'instrument', ruDescriptionShort: 'Прибор измерения давления.', placementNote: 'На напорных коллекторах и аппаратах.', auditNote: 'Датчики не должны напоминать насосы; оставлен компактный ISA-подобный бейдж.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 1.6, signalUnit: 'бар' } }),
  makeDefinition('temperatureSensor', { label: 'Датчик температуры', shortName: 'Температура', technicalPrefix: 'TIT', category: 'D. КИП и индикация', description: 'Контроль температуры.', className: 'instrument', family: 'instrument', accent: '#ffa08a', semanticSize: 'instrument', ruDescriptionShort: 'Температурный датчик/индикатор.', placementNote: 'На аппаратах и теплообменных участках.', auditNote: 'Используется общий круглый приборный язык с функциональным штрихом.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 22, signalUnit: '°C' } }),
  makeDefinition('levelSensor', { label: 'Датчик уровня', shortName: 'Уровень', technicalPrefix: 'LIT', category: 'D. КИП и индикация', description: 'Контроль уровня в аппарате.', className: 'instrument', family: 'instrument', accent: '#8ec5ff', semanticSize: 'instrument', ruDescriptionShort: 'Измерение уровня в ёмкости.', placementNote: 'У аппаратов, баков и реакторов.', auditNote: 'Круглый компактный бейдж отличает КИП от линейного оборудования.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 65, signalUnit: '%' } }),
  makeDefinition('phSensor', { label: 'Датчик pH', shortName: 'pH', technicalPrefix: 'AIT', category: 'D. КИП и индикация', description: 'Контроль кислотности.', className: 'instrument', family: 'instrument', accent: '#86f0c2', semanticSize: 'instrument', ruDescriptionShort: 'Аналитический датчик pH.', placementNote: 'На линиях контроля качества и CIP.', auditNote: 'Аналитический прибор требует собственной внутренней маркировки.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 7.2, signalUnit: 'pH' } }),
  makeDefinition('conductivitySensor', { label: 'Датчик проводимости', shortName: 'Проводим.', technicalPrefix: 'CIT', category: 'D. КИП и индикация', description: 'Контроль проводимости.', className: 'instrument', family: 'instrument', accent: '#98e4ff', semanticSize: 'instrument', ruDescriptionShort: 'Аналитический датчик проводимости.', placementNote: 'На водоподготовке и CIP-линиях.', auditNote: 'Приборный язык унифицирован, а функция читается по внутреннему маркеру.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { signalValue: 125, signalUnit: 'мкСм/см' } }),
  makeDefinition('indicator', { label: 'Индикатор', shortName: 'Индикатор', technicalPrefix: 'I', category: 'D. КИП и индикация', description: 'Общий индикатор состояния.', className: 'instrument', family: 'instrument', accent: '#9de0c5', semanticSize: 'instrument', ruDescriptionShort: 'Общий приборный индикатор.', placementNote: 'Там, где нужен только показ состояния.', auditNote: 'Индикатор оставлен самым нейтральным в приборной группе.', ports: { inputs: 1, outputs: 1, inline: true } }),
  makeDefinition('tee', { label: 'Тройник', shortName: 'Тройник', technicalPrefix: 'T', category: 'E. Топология и коллекторы', description: 'Узел ответвления на 3 направления.', className: 'topology', family: 'topology', accent: '#b5c7df', semanticSize: 'topology', ruDescriptionShort: 'Минимальный узел ответвления.', placementNote: 'Для врезки боковой ветви.', auditNote: 'Топология должна быть предельно технической и минимальной.', ports: { inputs: 1, outputs: 2, inline: true }, overrides: { topologyMode: 'distribution', junctionType: 'Тройник' } }),
  makeDefinition('cross', { label: 'Крестовина', shortName: 'Крестовина', technicalPrefix: 'X', category: 'E. Топология и коллекторы', description: 'Узел пересечения с четырьмя портами.', className: 'topology', family: 'topology', accent: '#c3d3ea', semanticSize: 'topology', ruDescriptionShort: 'Четырёхпортовый узел пересечения.', placementNote: 'Для компактного перекрёстного соединения.', auditNote: 'Ранее часть узлов использовала коробчатый язык, теперь он минимизирован.' , ports: { inputs: 2, outputs: 2, inline: true }, overrides: { topologyMode: 'distribution', junctionType: 'Крестовина' } }),
  makeDefinition('collector', { label: 'Коллектор', shortName: 'Коллектор', technicalPrefix: 'COL', category: 'E. Топология и коллекторы', description: 'Явный узел сбора нескольких линий.', className: 'topology', family: 'topology', accent: '#a8c4db', semanticSize: 'topology', ruDescriptionShort: 'Сбор нескольких ветвей в одну.', placementNote: 'Перед насосом, аппаратом или выпуском.', auditNote: 'Коллектор должен быть отличим от сплиттера направленностью.', ports: { inputs: 2, outputs: 1, inline: true }, overrides: { topologyMode: 'collection', junctionType: 'Коллектор' } }),
  makeDefinition('splitter', { label: 'Раздаточный узел', shortName: 'Раздатчик', technicalPrefix: 'SPL', category: 'E. Топология и коллекторы', description: 'Явный узел раздачи потока.', className: 'topology', family: 'topology', accent: '#a9c8e8', semanticSize: 'topology', ruDescriptionShort: 'Разделение одной линии на ветви.', placementNote: 'После насоса или общего коллектора.', auditNote: 'Раздача и сбор раньше были слишком похожи.', ports: { inputs: 1, outputs: 2, inline: true }, overrides: { topologyMode: 'distribution', junctionType: 'Раздаточный узел' } }),
  makeDefinition('mixingJunction', { label: 'Смесительный узел', shortName: 'Смеситель', technicalPrefix: 'MXJ', category: 'E. Топология и коллекторы', description: 'Явный узел смешения потоков.', className: 'topology', family: 'topology', accent: '#d8b8ff', semanticSize: 'topology', ruDescriptionShort: 'Топологический узел смешения.', placementNote: 'Перед inline-смесителем или реактором.', auditNote: 'Смешение теперь имеет технический знак, а не общий квадрат.', ports: { inputs: 2, outputs: 1, inline: true }, overrides: { topologyMode: 'mixing', junctionType: 'Смесительный узел' } }),
  makeDefinition('drainBranch', { label: 'Дренажное ответвление', shortName: 'Дренаж', technicalPrefix: 'DRB', category: 'F. Дренажи, пробы, терминалы', description: 'Организованный отвод в дренаж.', className: 'terminal', family: 'terminal', accent: '#9da8b8', semanticSize: 'topology', ruDescriptionShort: 'Отвод линии в дренажный выпуск.', placementNote: 'В нижних точках аппаратов и контуров.', auditNote: 'Дренажные функции вынесены из общей топологии в терминалы.', ports: { inputs: 1, outputs: 2, inline: true }, overrides: { topologyMode: 'drain', junctionType: 'Дренажное ответвление' } }),
  makeDefinition('samplePoint', { label: 'Точка отбора пробы', shortName: 'Проба', technicalPrefix: 'SP', category: 'F. Дренажи, пробы, терминалы', description: 'Узел для отбора технологической пробы.', className: 'terminal', family: 'terminal', accent: '#aed4c9', semanticSize: 'topology', ruDescriptionShort: 'Сервисный отбор контрольной пробы.', placementNote: 'На участках контроля качества.', auditNote: 'Пробоотборник не должен выглядеть как коллектор или прибор.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { topologyMode: 'distribution', junctionType: 'Точка отбора пробы' } }),
  makeDefinition('consumer', { label: 'Потребитель', shortName: 'Потребитель', technicalPrefix: 'CU', category: 'F. Дренажи, пробы, терминалы', description: 'Финальный потребитель среды.', className: 'major', family: 'terminal', accent: '#ff93a8', semanticSize: 'major', ruDescriptionShort: 'Конечный приёмник/потребитель среды.', placementNote: 'В конце маршрута подачи.', auditNote: 'Терминал должен читаться как конец линии, а не аппарат хранения.', ports: { inputs: 1, outputs: 0 } }),
  makeDefinition('utilityDrain', { label: 'Дренажный коллектор', shortName: 'Дренаж', technicalPrefix: 'DR', category: 'F. Дренажи, пробы, терминалы', description: 'Сбор и отвод в утиль.', className: 'major', family: 'terminal', accent: '#8793a8', semanticSize: 'major', ruDescriptionShort: 'Конечный сбор дренажных/утилизационных потоков.', placementNote: 'В конце дренажных и CIP-линий.', auditNote: 'Ранее дренаж делил образ с теплообменником; теперь это отдельный терминал.', ports: { inputs: 1, outputs: 0 }, overrides: { medium: 'waste', capacity: 0, level: 0, flowRate: 18 } }),
  makeDefinition('offPageConnector', { label: 'Переход на другой лист', shortName: 'Off-page', technicalPrefix: 'OPC', category: 'F. Дренажи, пробы, терминалы', description: 'Условный переход процесса на другой лист или схему.', className: 'terminal', family: 'terminal', accent: '#b8c8db', semanticSize: 'topology', ruDescriptionShort: 'Плейсхолдер межлистовой связи.', placementNote: 'На границе фрагмента схемы или интерфейса между листами.', auditNote: 'Межлистовой коннектор должен быть мгновенно отличим от потребителя и дренажа.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { topologyMode: 'distribution', junctionType: 'Переход на другой лист', activityLabel: 'Переход' } }),
  makeDefinition('serviceTerminal', { label: 'Сервисный терминал', shortName: 'Сервис', technicalPrefix: 'ST', category: 'F. Дренажи, пробы, терминалы', description: 'Точка подключения сервисной среды или обслуживания.', className: 'terminal', family: 'terminal', accent: '#9bc0d8', semanticSize: 'topology', ruDescriptionShort: 'Подключение к utility / сервисной линии.', placementNote: 'На CIP, utility и сервисных врезках.', auditNote: 'Сервисная точка не должна смешиваться с пробоотбором или off-page связью.', ports: { inputs: 1, outputs: 1, inline: true }, overrides: { topologyMode: 'distribution', junctionType: 'Сервисный терминал', medium: 'water', activityLabel: 'Service tie-in' } }),
];

export const componentMap = new Map(componentRegistry.map((item) => [item.type, item]));
