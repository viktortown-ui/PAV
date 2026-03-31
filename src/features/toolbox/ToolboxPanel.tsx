import { LeftShellEvent, LeftShellState } from './leftShellState';

type ToolboxPanelProps = {
  leftShell: LeftShellState;
  stateMachineDefinition: string;
  onEvent: (event: LeftShellEvent) => void;
  onOpenLibrary: () => void;
  activeCanvasTool: 'select' | 'connect';
  gridEnabled: boolean;
  activeRightPanel: 'lines' | 'diagnostics' | null;
  onSelectTool: (tool: 'select' | 'connect') => void;
  onToggleGrid: () => void;
  onTogglePanel: (panel: 'lines' | 'diagnostics') => void;
  presentationMode: 'simulation' | 'schematic';
};

type RailControl = {
  id: string;
  label: string;
  glyph: string;
  description: string;
  type: 'mode' | 'toggle' | 'action';
  isActive: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
};

type RailGroup = {
  id: string;
  title: string;
  controls: RailControl[];
};

export const ToolboxPanel = ({
  leftShell,
  stateMachineDefinition,
  onEvent,
  onOpenLibrary,
  activeCanvasTool,
  gridEnabled,
  activeRightPanel,
  onSelectTool,
  onToggleGrid,
  onTogglePanel,
  presentationMode,
}: ToolboxPanelProps) => {
  const isExpanded = leftShell.drawerOpen;
  const isFocus = leftShell.mode === 'focus';
  const simulationMode = presentationMode === 'simulation';

  const groups: RailGroup[] = [
    {
      id: 'selection',
      title: 'Выбор',
      controls: [
        {
          id: 'select',
          label: 'Курсор',
          glyph: '↖',
          description: 'Выбор и редактирование объектов схемы.',
          type: 'mode',
          isActive: activeCanvasTool === 'select',
          onClick: () => onSelectTool('select'),
        },
        {
          id: 'connect',
          label: 'Соединение',
          glyph: '⟷',
          description: simulationMode
            ? 'В режиме «Симуляция» прокладка связей отключена. Переключитесь в режим «Схема». '
            : 'Создание и прокладка связей между узлами.',
          type: 'mode',
          isActive: activeCanvasTool === 'connect',
          disabled: simulationMode,
          disabledReason: 'Доступно только в режиме «Схема».',
          onClick: () => onSelectTool('connect'),
        },
      ],
    },
    {
      id: 'view',
      title: 'Вид и привязка',
      controls: [
        {
          id: 'grid',
          label: 'Сетка',
          glyph: '#',
          description: 'Показ сетки и привязка к шагу при перетаскивании.',
          type: 'toggle',
          isActive: gridEnabled,
          onClick: onToggleGrid,
        },
      ],
    },
    {
      id: 'panels',
      title: 'Контроль',
      controls: [
        {
          id: 'lines',
          label: 'Линии',
          glyph: '≋',
          description: 'Список линий, переход к сегментам и маршрутам.',
          type: 'toggle',
          isActive: activeRightPanel === 'lines',
          onClick: () => onTogglePanel('lines'),
        },
        {
          id: 'diagnostics',
          label: 'Диагностика',
          glyph: '◔',
          description: 'Ошибки, предупреждения и метрики текущей схемы.',
          type: 'toggle',
          isActive: activeRightPanel === 'diagnostics',
          onClick: () => onTogglePanel('diagnostics'),
        },
      ],
    },
    {
      id: 'service',
      title: 'Сервис',
      controls: [
        {
          id: 'library',
          label: 'Библиотека',
          glyph: '⌘',
          description: 'Открыть библиотеку оборудования и шаблонов.',
          type: 'action',
          isActive: false,
          onClick: onOpenLibrary,
        },
        {
          id: 'focus',
          label: 'Режим схемы',
          glyph: isFocus ? '◉' : '○',
          description: isFocus
            ? 'Компактный режим без боковых панелей.'
            : 'Скрыть панели и оставить только рабочее полотно.',
          type: 'toggle',
          isActive: isFocus,
          onClick: () => onEvent({ type: isFocus ? 'exit-focus' : 'enter-focus' }),
        },
      ],
    },
  ];

  return (
    <aside className="toolbox-shell tool-rail-shell" aria-label="Левая инструментальная панель" data-expanded={isExpanded ? 'true' : 'false'}>
      <div className="shell-rail shell-rail-left" aria-label="Инструменты схемы">
        <button
          type="button"
          className={`rail-expand-toggle ${isExpanded ? 'is-active' : ''}`}
          onClick={() => onEvent({ type: 'toggle-drawer' })}
          aria-pressed={isExpanded}
          title={isExpanded ? 'Свернуть панель инструментов' : 'Развернуть панель инструментов'}
          aria-label={isExpanded ? 'Свернуть панель инструментов' : 'Развернуть панель инструментов'}
        >
          <span className="tool-rail-glyph">{isExpanded ? '«' : '»'}</span>
          {isExpanded ? <span className="rail-control-copy"><strong>Инструменты</strong><small>{simulationMode ? 'Режим: Симуляция' : 'Режим: Схема'}</small></span> : null}
        </button>

        <div className="rail-groups" role="list">
          {groups.map((group) => (
            <section key={group.id} className="rail-group" aria-label={group.title}>
              {isExpanded ? <div className="rail-group-title">{group.title}</div> : null}
              {group.controls.map((control) => {
                const title = control.disabled ? `${control.label}: ${control.disabledReason ?? control.description}` : `${control.label}: ${control.description}`;
                return (
                  <button
                    key={control.id}
                    type="button"
                    className={`rail-control ${control.isActive ? 'is-active' : ''} ${control.disabled ? 'is-disabled' : ''}`}
                    onClick={control.onClick}
                    disabled={control.disabled}
                    aria-pressed={control.type !== 'action' ? control.isActive : undefined}
                    aria-label={control.label}
                    title={title}
                  >
                    <span className="tool-rail-glyph" aria-hidden="true">{control.glyph}</span>
                    {isExpanded ? (
                      <span className="rail-control-copy">
                        <strong>{control.label}</strong>
                        <small>{control.disabledReason ?? control.description}</small>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </div>
      <div className="tool-rail-footnote">{stateMachineDefinition.split('\n')[1]?.trim() ?? 'СОСТОЯНИЕ ЛЕВОЙ ПАНЕЛИ'}</div>
    </aside>
  );
};
