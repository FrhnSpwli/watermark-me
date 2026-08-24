import type { ComposerConversionController } from '../../hooks/useComposerConversion'
import { getConversionProgressMessage } from '../../lib/conversion/conversionOutput'
import { formatFileSize } from '../../utils/format'

interface ComposerConversionPanelProps {
  controller: ComposerConversionController
  sourcesReady: boolean
}

export function ComposerConversionPanel({
  controller,
  sourcesReady,
}: ComposerConversionPanelProps) {
  const {
    options,
    target,
    selectedOption,
    selectTarget,
    canConvert,
    convert,
    cancel,
    lifecycle,
    isConverting,
    interactionLocked,
    currentSuccess,
    currentError,
    wasCancelled,
    downloadLifecycle,
    download,
    downloadArtifact,
  } = controller
  const outputSize = currentSuccess?.result.artifacts.reduce(
    (total, artifact) => total + artifact.blob.size,
    0,
  )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
          Conversion output
        </p>
        <h2 className="mt-1 font-bold text-slate-950">
          Choose a format and convert
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Conversion happens in your browser. Generated files are not uploaded.
        </p>
      </div>

      {!sourcesReady ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600" role="status">
          Finish preparing the private sources before converting.
        </div>
      ) : options.length === 0 ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Select at least one item to choose an output.
        </div>
      ) : (
        <fieldset className="mt-5" disabled={interactionLocked}>
          <legend className="text-sm font-bold text-slate-900">Output format</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {options.map((option) => {
              const isSelected = option.target === target
              return (
                <label
                  className={`rounded-xl border p-3 transition ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                      : 'border-slate-200 bg-white hover:border-indigo-300'
                  } ${interactionLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                  key={option.target}
                >
                  <span className="flex items-center gap-2">
                    <input
                      checked={isSelected}
                      className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      name="conversion-output-format"
                      onChange={() => selectTarget(option.target)}
                      type="radio"
                      value={option.target}
                    />
                    <span className="text-sm font-bold text-slate-950">
                      {option.label}
                    </span>
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-slate-600">
                    {option.description}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      {sourcesReady && selectedOption ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          <p className="font-semibold">
            Ready for {selectedOption.label}: {selectedOption.description}
          </p>
        </div>
      ) : null}

      {sourcesReady && selectedOption?.warnings.length ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-bold">Please note</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {selectedOption.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canConvert}
          onClick={() => void convert()}
          type="button"
        >
          {isConverting ? 'Converting...' : `Convert${selectedOption ? ` to ${selectedOption.label}` : ''}`}
        </button>
        {isConverting ? (
          <button
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={cancel}
            type="button"
          >
            Cancel conversion
          </button>
        ) : null}
      </div>

      {lifecycle.status === 'converting' ? (
        <div className="mt-5" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
            <span className="font-semibold">
              {getConversionProgressMessage(lifecycle.progress)}
            </span>
            <span aria-hidden="true">
              {Math.round(
                (Math.min(lifecycle.progress.completed, lifecycle.progress.total) /
                  Math.max(lifecycle.progress.total, 1)) *
                  100,
              )}%
            </span>
          </div>
          <progress
            className="mt-2 h-2 w-full accent-indigo-600"
            max={Math.max(lifecycle.progress.total, 1)}
            value={Math.min(
              lifecycle.progress.completed,
              lifecycle.progress.total,
            )}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Selection, order, and output format stay locked until this operation finishes or is cancelled.
          </p>
        </div>
      ) : null}

      {currentError ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
          <p className="font-bold">Conversion failed</p>
          <p className="mt-1">{currentError}</p>
          <p className="mt-1">Your current selection and order were kept so you can try again.</p>
        </div>
      ) : null}

      {wasCancelled ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700" role="status">
          Conversion cancelled. No output was generated; you can convert again when ready.
        </div>
      ) : null}

      {currentSuccess ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950" role="status">
          <p className="font-bold">Conversion complete</p>
          <p className="mt-1 leading-6">
            {currentSuccess.result.artifacts.length}{' '}
            {selectedOption?.label ?? 'output'} {currentSuccess.result.artifacts.length === 1 ? 'file' : 'files'} generated
            {outputSize === undefined ? '.' : ` (${formatFileSize(outputSize)} total).`}
          </p>
          <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-lg bg-white/70 p-3 text-xs text-slate-700">
            {currentSuccess.filenames.map((filename, index) => (
              <li className="flex flex-wrap items-center justify-between gap-2" key={filename}>
                <span className="min-w-0 break-all font-mono">{filename}</span>
                {currentSuccess.result.artifacts.length > 1 ? (
                  <button
                    aria-label={`Download ${filename}`}
                    className="shrink-0 rounded-lg border border-emerald-700 bg-white px-3 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                    disabled={interactionLocked}
                    onClick={() => downloadArtifact(index)}
                    type="button"
                  >
                    Download
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <button
            className="mt-4 max-w-full break-all rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={interactionLocked}
            onClick={() => void download()}
            type="button"
          >
            {downloadLifecycle.status === 'preparing'
              ? `Preparing ZIP... ${downloadLifecycle.percent}%`
              : currentSuccess.result.artifacts.length === 1
                ? `Download ${currentSuccess.filenames[0]}`
                : 'Download all as ZIP'}
          </button>
        </div>
      ) : null}

      {downloadLifecycle.status === 'started' ? (
        <p className="mt-3 text-sm font-medium text-emerald-800" role="status">
          {downloadLifecycle.message}
        </p>
      ) : null}
      {downloadLifecycle.status === 'error' ? (
        <p className="mt-3 text-sm font-medium text-red-700" role="alert">
          {downloadLifecycle.message}
        </p>
      ) : null}
    </section>
  )
}
