import { useEffect, useMemo, useState } from 'react';
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

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const context = useMemo(() => inferWizardContext(project, selectedNodeId, selectedEdgeId), [project, selectedEdgeId, selectedNodeId]);
  const subtypes = wizard.groupId ? getWizardSubtypes(wizard.groupId) : [];
  const fields = wizard.kind && wizard.groupId ? getWizardFields(project, wizard.groupId, wizard.kind, context) : [];
  const requiredFields = fields.filter((field) => field.required);
  const optionalFields = fields.filter((field) => !field.required);

  useEffect(() => {
    if (!wizard.open) setAdvancedOpen(false);
  }, [wizard.open, wizard.groupId, wizard.kind]);

  if (!wizard.open || !wizard.groupId || !wizard.kind) return null;

  const renderField = (field: (typeof fields)[number]) => {
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
  };

  return (
    <div className="wizard-overlay" role="dialog" aria-modal="true" aria-label="Создать элемент">
      <div className="wizard-card">
        <div className="wizard-head">
          <div>
            <span className="wizard-kicker">Создать элемент</span>
            <h2>Новый элемент</h2>
            <p>Выберите семейство, тип и заполните поля.</p>
          </div>
          <button className="wizard-close" onClick={closeWizard}>✕</button>
        </div>

        <div className="wizard-steps">
          <section>
            <div className="wizard-step-title">1. Выберите семейство</div>
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
            <div className="wizard-step-title">2. Выберите тип</div>
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
            <div className="wizard-step-title">3. Заполните поля</div>
            <div className="wizard-context-grid">
              <div><span>Среда</span><strong>{context.inferredMedium ?? 'water'}</strong></div>
              <div><span>Диаметр</span><strong>{context.inferredDiameter ?? 'DN50'}</strong></div>
              <div><span>Тег</span><strong>{wizard.values.technicalTag || '—'}</strong></div>
              <div><span>Группа</span><strong>{wizardGroups.find((group) => group.id === wizard.groupId)?.label}</strong></div>
            </div>
            <div className="wizard-section-note">Проверьте поля перед созданием.</div>
            <div className="wizard-form-grid">
              {requiredFields.map(renderField)}
            </div>
            {optionalFields.length ? (
              <div className="wizard-advanced">
                <button type="button" className={advancedOpen ? 'wizard-advanced-toggle is-open' : 'wizard-advanced-toggle'} onClick={() => setAdvancedOpen((value) => !value)} aria-expanded={advancedOpen}>
                  <span>4. Дополнительно</span>
                  <strong>{advancedOpen ? 'Свернуть' : 'Открыть'}</strong>
                </button>
                {advancedOpen ? <div className="wizard-form-grid">{optionalFields.map(renderField)}</div> : null}
              </div>
            ) : null}
          </section>
        </div>

        <div className="wizard-footer">
          <div className="wizard-footer-copy">
            <strong>Готово</strong>
            <span>Проверьте тег и поля.</span>
          </div>
          <div className="wizard-footer-actions">
            <button onClick={regenerateWizardTag}>Новый тег</button>
            <button className="primary" onClick={createEquipment}>Создать элемент</button>
          </div>
        </div>
      </div>
    </div>
  );
};
