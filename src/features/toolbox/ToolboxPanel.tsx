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
};

const railActions = [
  { id: 'select', label: 'Выбор', glyph: '↖︎', hint: 'Режим выбора и редактирования узлов.' },
  { id: 'connect', label: 'Связи', glyph: '⟷', hint: 'Режим соединения и прокладки маршрутов.' },
  { id: 'layers', label: 'Структура', glyph: '☰', hint: 'Открыть список линий и структуру связей.' },
  { id: 'grid', label: 'Сетка', glyph: '#', hint: 'Показать/скрыть сетку и привязку.' },
  { id: 'metrics', label: 'Метрики', glyph: '◔', hint: 'Показать диагностику и метрики схемы.' },
];

export const ToolboxPanel = ({ leftShell, stateMachineDefinition, onEvent, onOpenLibrary, activeCanvasTool, gridEnabled, activeRightPanel, onSelectTool, onToggleGrid, onTogglePanel }: ToolboxPanelProps) => (
  <aside className="toolbox-shell tool-rail-shell" aria-label="Левый инструментальный rail">
    <div className="shell-rail shell-rail-left" aria-label="Инструменты схемы">
      {railActions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={`rail-icon-button ${(
            (action.id === 'select' && activeCanvasTool === 'select')
            || (action.id === 'connect' && activeCanvasTool === 'connect')
            || (action.id === 'grid' && gridEnabled)
            || (action.id === 'layers' && activeRightPanel === 'lines')
            || (action.id === 'metrics' && activeRightPanel === 'diagnostics')
          ) ? 'is-active' : ''}`}
          onClick={() => {
            if (action.id === 'select') onSelectTool('select');
            if (action.id === 'connect') onSelectTool('connect');
            if (action.id === 'grid') onToggleGrid();
            if (action.id === 'layers') onTogglePanel('lines');
            if (action.id === 'metrics') onTogglePanel('diagnostics');
          }}
          title={action.hint}
          aria-label={action.label}
          aria-pressed={
            action.id === 'select' || action.id === 'connect'
              ? activeCanvasTool === action.id
              : action.id === 'grid'
                ? gridEnabled
                : action.id === 'layers'
                  ? activeRightPanel === 'lines'
                  : action.id === 'metrics'
                    ? activeRightPanel === 'diagnostics'
                    : false
          }
        >
          <span className="tool-rail-glyph">{action.glyph}</span>
        </button>
      ))}
      <button type="button" className="rail-icon-button rail-icon-button-library" onClick={onOpenLibrary} title="Открыть библиотеку" aria-label="Открыть библиотеку">
        <span className="tool-rail-glyph">⌘</span>
      </button>
      <button type="button" className={`rail-icon-button ${leftShell.mode === 'focus' ? 'is-active' : ''}`} onClick={() => onEvent({ type: leftShell.mode === 'focus' ? 'exit-focus' : 'enter-focus' })} title="Режим схемы" aria-label="Режим схемы">
        <span className="tool-rail-glyph">{leftShell.mode === 'focus' ? '◉' : '○'}</span>
      </button>
    </div>
    <div className="tool-rail-footnote">{stateMachineDefinition.split('\n')[1]?.trim() ?? 'LEFT SHELL STATE MACHINE'}</div>
  </aside>
);
