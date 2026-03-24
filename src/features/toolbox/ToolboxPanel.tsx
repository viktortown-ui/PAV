import { LeftShellEvent, LeftShellState } from './leftShellState';

type ToolboxPanelProps = {
  leftShell: LeftShellState;
  stateMachineDefinition: string;
  onEvent: (event: LeftShellEvent) => void;
  onOpenLibrary: () => void;
};

const railActions = [
  { id: 'select', label: 'Выбор', glyph: '↖︎', hint: 'Режим выбора и редактирования узлов.' },
  { id: 'connect', label: 'Связи', glyph: '⟷', hint: 'Создание и корректировка маршрутов.' },
  { id: 'layers', label: 'Слои', glyph: '☰', hint: 'Слои и состав рабочей области.' },
  { id: 'grid', label: 'Сетка', glyph: '#', hint: 'Привязка к сетке и шаг.' },
  { id: 'metrics', label: 'Метрики', glyph: '◔', hint: 'Быстрые индикаторы схемы.' },
];

export const ToolboxPanel = ({ leftShell, stateMachineDefinition, onEvent, onOpenLibrary }: ToolboxPanelProps) => (
  <aside className="toolbox-shell tool-rail-shell" aria-label="Левый инструментальный rail">
    <div className="shell-rail shell-rail-left" aria-label="Инструменты схемы">
      {railActions.map((action) => (
        <button key={action.id} type="button" className="rail-icon-button" title={action.hint} aria-label={action.label}>
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
