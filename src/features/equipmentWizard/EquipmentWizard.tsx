import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { getWizardFields, getWizardSubtypes, inferWizardContext, wizardGroups } from './schema';

const boolFromValue = (value: string | number | boolean) => value === true || value === 'true' || value === 1;

export const EquipmentWizard = () => {
  const wizard = useAppStore((state) => state.wizard);
  const project = useAppStore((state) => state.project);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId);
  const closeWizard = useAppStore((state) => state.closeEquipmentWizard);
  const setWizardGroup = useAppStore((state) => state.setWizardGroup);
  const setWizardKind = useAppStore((state) => state.setWizardKind);
  const updateWizardValue = useAppStore((state) => state.updateWizardValue);
  const regenerateWizardTag = useAppStore((state) => state.regenerateWizardTag);
  const createEquipment = useAppStore((state) => state.createEquipmentFromWizard);

  const context = useMemo(() => inferWizardContext(project, selectedNodeId, selectedEdgeId), [project, selectedEdgeId, selectedNodeId]);
  const subtypes = wizard.groupId ? getWizardSubtypes(wizard.groupId) : [];
  const fields = wizard.kind && wizard.groupId ? getWizardFields(project, wizard.groupId, wizard.kind, context) : [];

  if (!wizard.open || !wizard.groupId || !wizard.kind) return null;

  return (
    <div className="wizard-overlay" role="dialog" aria-modal="true" aria-label="Добавление оборудования">
      <div className="wizard-card">
        <div className="wizard-head">
          <div>
            <span className="wizard-kicker">Добавление оборудования</span>
            <h2>Новый элемент</h2>
            <p>Выберите тип оборудования и заполните основные параметры.</p>
          </div>
          <button className="wizard-close" onClick={closeWizard}>✕</button>
        </div>

        <div className="wizard-steps">
          <section>
            <div className="wizard-step-title">1. Группа</div>
            <div className="wizard-chip-grid">
              {wizardGroups.map((group) => (
                <button key={group.id} className={wizard.groupId === group.id ? 'wizard-chip is-active' : 'wizard-chip'} onClick={() => setWizardGroup(group.id)}>
                  <strong>{group.label}</strong>
                  <span>{group.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="wizard-step-title">2. Подтип</div>
            <div className="wizard-subtype-list">
              {subtypes.map((subtype) => (
                <button key={subtype.kind} className={wizard.kind === subtype.kind ? 'wizard-subtype is-active' : 'wizard-subtype'} onClick={() => setWizardKind(subtype.kind)}>
                  <strong>{subtype.label}</strong>
                  <span>{subtype.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="wizard-step-title">3. Параметры</div>
            <div className="wizard-context-grid">
              <div><span>Среда</span><strong>{context.inferredMedium ?? 'water'}</strong></div>
              <div><span>Диаметр</span><strong>{context.inferredDiameter ?? 'DN50'}</strong></div>
              <div><span>Шаблон тега</span><strong>{wizard.namingRule}</strong></div>
              <div><span>Источник настроек</span><strong>{wizardGroups.find((group) => group.id === wizard.groupId)?.label}</strong></div>
            </div>
            <div className="wizard-form-grid">
              {fields.map((field) => {
                const value = wizard.values[field.key] ?? '';
                return (
                  <label key={field.key} className="wizard-field">
                    <span>{field.label}{field.required ? ' *' : ''}{field.unitHint ? `, ${field.unitHint}` : ''}</span>
                    {field.type === 'number' ? (
                      <input type="number" value={String(value)} onChange={(e) => updateWizardValue(field.key, Number(e.target.value))} />
                    ) : field.type === 'select' ? (
                      <select value={String(value)} onChange={(e) => updateWizardValue(field.key, e.target.value)}>
                        {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : field.type === 'toggle' ? (
                      <input type="checkbox" checked={boolFromValue(value)} onChange={(e) => updateWizardValue(field.key, e.target.checked)} />
                    ) : (
                      <input type="text" value={String(value)} onChange={(e) => updateWizardValue(field.key, e.target.value)} />
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <div className="wizard-footer">
          <div className="wizard-footer-copy">
            <strong>Подстановка по схеме</strong>
            <span>Среда, диаметр и тег подставлены автоматически. Проверьте данные перед добавлением.</span>
          </div>
          <div className="wizard-footer-actions">
            <button onClick={regenerateWizardTag}>Обновить тег</button>
            <button className="primary" onClick={createEquipment}>Добавить элемент</button>
          </div>
        </div>
      </div>
    </div>
  );
};
