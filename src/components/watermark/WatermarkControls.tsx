import {
  MAX_FONT_SIZE_RATIO,
  MAX_RECIPIENT_LENGTH,
  MAX_WATERMARK_OPACITY,
  MAX_WATERMARK_ROTATION,
  MAX_WATERMARK_TEXT_LENGTH,
  MIN_FONT_SIZE_RATIO,
  MIN_WATERMARK_OPACITY,
  MIN_WATERMARK_ROTATION,
  getPurposeOption,
  WATERMARK_POSITIONS,
  WATERMARK_PURPOSES,
} from '../../lib/watermark/watermarkConfig'
import type {
  WatermarkSettings,
  WatermarkPurpose,
} from '../../types/watermark'

interface WatermarkControlsProps {
  purpose: WatermarkPurpose
  recipient: string
  settings: WatermarkSettings
  recipientError: string | null
  textError: string | null
  isDownloadReady: boolean
  readinessMessage: string
  showResetText: boolean
  disabled?: boolean
  onPurposeChange: (purpose: WatermarkPurpose) => void
  onRecipientChange: (recipient: string) => void
  onRecipientBlur: () => void
  onResetText: () => void
  onTextChange: (text: string) => void
  onSettingsChange: (settings: WatermarkSettings) => void
}

export function WatermarkControls({
  purpose,
  recipient,
  settings,
  recipientError,
  textError,
  isDownloadReady,
  readinessMessage,
  showResetText,
  disabled = false,
  onPurposeChange,
  onRecipientChange,
  onRecipientBlur,
  onResetText,
  onTextChange,
  onSettingsChange,
}: WatermarkControlsProps) {
  const positionDescription =
    WATERMARK_POSITIONS.find((option) => option.value === settings.position)
      ?.description ?? ''
  const purposeOption = getPurposeOption(purpose)

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-sm font-bold text-slate-950">Purpose details</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Explain why the copy is being created and who will receive it.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-800" htmlFor="watermark-purpose">
          Purpose
        </label>
        <select
          aria-describedby="watermark-purpose-help"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
          disabled={disabled}
          id="watermark-purpose"
          onChange={(event) => onPurposeChange(event.target.value as WatermarkPurpose)}
          value={purpose}
        >
          {WATERMARK_PURPOSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-5 text-slate-500" id="watermark-purpose-help">
          {purposeOption.description}
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-800" htmlFor="watermark-recipient">
          Recipient / Organization
        </label>
        <input
          aria-describedby={recipientError ? 'watermark-recipient-error' : 'watermark-recipient-help'}
          aria-invalid={Boolean(recipientError)}
          className={`mt-2 w-full rounded-xl border bg-white px-3.5 py-3 text-base shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 ${
            recipientError ? 'border-red-400' : 'border-slate-300'
          }`}
          disabled={disabled}
          id="watermark-recipient"
          maxLength={MAX_RECIPIENT_LENGTH}
          onBlur={onRecipientBlur}
          onChange={(event) => onRecipientChange(event.target.value)}
          placeholder={purposeOption.recipientPlaceholder}
          required={purposeOption.recipientRequired}
          type="text"
          value={recipient}
        />
        {recipientError ? (
          <p className="mt-2 text-sm text-red-700" id="watermark-recipient-error" role="alert">
            {recipientError}
          </p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-slate-500" id="watermark-recipient-help">
            {purpose === 'other'
              ? `Optional · ${recipient.length}/${MAX_RECIPIENT_LENGTH} characters.`
              : `Required · ${recipient.length}/${MAX_RECIPIENT_LENGTH} characters.`}
          </p>
        )}
      </div>

      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="block text-sm font-semibold text-slate-800" htmlFor="watermark-text">
            Watermark text
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {showResetText ? (
              <button
                className="rounded text-xs font-semibold text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                disabled={disabled}
                onClick={onResetText}
                type="button"
              >
                Reset to generated text
              </button>
            ) : null}
            <span className="text-xs text-slate-500">
              {settings.text.length}/{MAX_WATERMARK_TEXT_LENGTH}
            </span>
          </div>
        </div>
        <textarea
          aria-describedby={textError ? 'watermark-text-error' : 'watermark-text-help'}
          aria-invalid={Boolean(textError)}
          className={`mt-2 min-h-32 w-full resize-y rounded-xl border bg-white px-3.5 py-3 font-mono text-sm leading-6 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 ${
            textError ? 'border-red-400' : 'border-slate-300'
          }`}
          disabled={disabled}
          id="watermark-text"
          maxLength={MAX_WATERMARK_TEXT_LENGTH}
          onChange={(event) => onTextChange(event.target.value)}
          required
          value={settings.text}
        />
        {textError ? (
          <p className="mt-2 text-sm text-red-700" id="watermark-text-error" role="alert">
            {textError}
          </p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-slate-500" id="watermark-text-help">
            {showResetText
              ? 'Your edits are preserved when purpose or recipient changes.'
              : 'Line breaks are preserved in the generated document.'}
          </p>
        )}
      </div>

      <p
        className={`rounded-xl border px-3.5 py-3 text-xs font-medium leading-5 ${
          isDownloadReady
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
        role="status"
      >
        {readinessMessage}
      </p>

      <div className="border-t border-slate-200 pt-5">
        <h3 className="text-sm font-bold text-slate-950">Appearance</h3>
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-semibold text-slate-800" htmlFor="watermark-opacity">
            Opacity
          </label>
          <output className="text-sm font-medium text-slate-600" htmlFor="watermark-opacity">
            {Math.round(settings.opacity * 100)}%
          </output>
        </div>
        <input
          className="mt-3 w-full accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
          disabled={disabled}
          id="watermark-opacity"
          max={MAX_WATERMARK_OPACITY * 100}
          min={MIN_WATERMARK_OPACITY * 100}
          onChange={(event) =>
            onSettingsChange({ ...settings, opacity: Number(event.target.value) / 100 })
          }
          step="5"
          type="range"
          value={settings.opacity * 100}
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-semibold text-slate-800" htmlFor="watermark-rotation">
            Rotation
          </label>
          <output className="text-sm font-medium text-slate-600" htmlFor="watermark-rotation">
            {settings.rotationDegrees}°
          </output>
        </div>
        <input
          className="mt-3 w-full accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
          disabled={disabled}
          id="watermark-rotation"
          max={MAX_WATERMARK_ROTATION}
          min={MIN_WATERMARK_ROTATION}
          onChange={(event) =>
            onSettingsChange({ ...settings, rotationDegrees: Number(event.target.value) })
          }
          step="5"
          type="range"
          value={settings.rotationDegrees}
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-semibold text-slate-800" htmlFor="watermark-font-size">
            Watermark size
          </label>
          <output className="text-sm font-medium text-slate-600" htmlFor="watermark-font-size">
            {(settings.fontSizeRatio * 100).toFixed(1)}%
          </output>
        </div>
        <input
          aria-describedby="watermark-font-size-help"
          className="mt-3 w-full accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
          disabled={disabled}
          id="watermark-font-size"
          max={MAX_FONT_SIZE_RATIO * 100}
          min={MIN_FONT_SIZE_RATIO * 100}
          onChange={(event) =>
            onSettingsChange({ ...settings, fontSizeRatio: Number(event.target.value) / 100 })
          }
          step="0.5"
          type="range"
          value={settings.fontSizeRatio * 100}
        />
        <p className="mt-2 text-xs leading-5 text-slate-500" id="watermark-font-size-help">
          Scales relative to each image or PDF page while preserving the text hierarchy.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">Position</legend>
        <div
          aria-describedby="watermark-position-help"
          aria-label="Watermark position"
          className="mt-3 grid w-full max-w-52 grid-cols-3 gap-1.5 rounded-xl bg-slate-50 p-1.5"
          role="group"
        >
          {WATERMARK_POSITIONS.map((option) => {
            const isSelected = settings.position === option.value

            return (
              <button
                aria-label={option.label}
                aria-pressed={isSelected}
                className={`grid aspect-square min-h-11 place-items-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                }`}
                disabled={disabled}
                key={option.value}
                onClick={() =>
                  onSettingsChange({ ...settings, position: option.value })
                }
                title={option.label}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`rounded-full transition-all ${
                    isSelected
                      ? 'size-3 bg-indigo-600 ring-4 ring-indigo-100'
                      : 'size-2 bg-slate-400'
                  }`}
                />
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500" id="watermark-position-help">
          {positionDescription} Rotation remains independent.
        </p>
      </fieldset>
    </div>
  )
}
