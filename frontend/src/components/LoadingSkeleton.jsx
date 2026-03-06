export function MapSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-ww-dark">
      <div className="text-center">
        <div className="inline-block w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-gray-400 text-sm">Loading map data...</p>
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-3">
      <div className="bg-ww-surface/90 border border-ww-border rounded-xl p-4">
        <div className="w-24 h-24 mx-auto rounded-full bg-gray-700 animate-skeleton mb-3" />
        <div className="w-20 h-4 mx-auto bg-gray-700 animate-skeleton rounded" />
      </div>
      <div className="bg-ww-surface/90 border border-ww-border rounded-xl p-4 space-y-3">
        <div className="w-full h-4 bg-gray-700 animate-skeleton rounded" />
        <div className="w-3/4 h-4 bg-gray-700 animate-skeleton rounded" />
        <div className="w-1/2 h-4 bg-gray-700 animate-skeleton rounded" />
        <div className="w-full h-3 bg-gray-700 animate-skeleton rounded mt-4" />
        <div className="w-2/3 h-3 bg-gray-700 animate-skeleton rounded" />
      </div>
    </div>
  );
}
