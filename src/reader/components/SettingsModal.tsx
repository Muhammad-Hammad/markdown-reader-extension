import { FONT_OPTIONS, MODE_CYCLE } from '../constants'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'
import Modal from './Modal'

function SettingsModal() {
  const {
    actions: { exportSettings, importSettingsFromFile, setSettingsOpen, updateSettings },
    state: { settings, settingsOpen },
  } = useReaderWorkspaceContext()

  if (!settingsOpen) {
    return null
  }

  return (
    <Modal title="Reader settings" onClose={() => setSettingsOpen(false)}>
      <div className="settings-grid">
        <label>
          Mode
          <select
            value={settings.mode}
            onChange={(event) =>
              updateSettings({
                mode: event.target.value as typeof settings.mode,
                focusParagraphs: event.target.value === 'focus',
              })
            }
          >
            {MODE_CYCLE.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label>
          Font family
          <select
            value={settings.fontFamily}
            onChange={(event) => updateSettings({ fontFamily: event.target.value as typeof settings.fontFamily })}
          >
            {FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <RangeField
          label="Font size"
          max={24}
          min={12}
          value={settings.fontSize}
          onChange={(value) => updateSettings({ fontSize: value })}
        />
        <RangeField
          label="Line height"
          max={2.3}
          min={1.2}
          step={0.05}
          value={settings.lineHeight}
          onChange={(value) => updateSettings({ lineHeight: value })}
        />
        <RangeField
          label="Content width"
          max={1280}
          min={680}
          step={20}
          value={settings.contentWidth}
          onChange={(value) => updateSettings({ contentWidth: value })}
        />
        <CheckboxField
          checked={settings.centered}
          label="Center content"
          onChange={(checked) => updateSettings({ centered: checked })}
        />
        <CheckboxField
          checked={settings.codeWrap}
          label="Wrap code blocks"
          onChange={(checked) => updateSettings({ codeWrap: checked })}
        />
        <CheckboxField
          checked={settings.autoRefresh}
          label="Auto-refresh"
          onChange={(checked) => updateSettings({ autoRefresh: checked })}
        />
        <CheckboxField
          checked={settings.focusParagraphs}
          label="Focus active paragraph"
          onChange={(checked) => updateSettings({ focusParagraphs: checked })}
        />
      </div>

      <div className="modal-actions">
        <button type="button" className="toolbar-button" onClick={exportSettings}>
          Export settings JSON
        </button>
        <label className="toolbar-button file-input-button">
          Import settings JSON
          <input type="file" accept="application/json" onChange={importSettingsFromFile} />
        </label>
      </div>
    </Modal>
  )
}

function RangeField({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step?: number
  value: number
}) {
  return (
    <label>
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function CheckboxField({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="checkbox-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

export default SettingsModal
