interface RouteLoadingScreenProps {
  message?: string
}

export function RouteLoadingScreen({
  message = 'Loading page…',
}: RouteLoadingScreenProps) {
  return (
    <div className="grid min-h-[50vh] place-items-center px-4" role="status">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <span
          aria-hidden="true"
          className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 motion-reduce:animate-none"
        />
        {message}
      </div>
    </div>
  )
}
