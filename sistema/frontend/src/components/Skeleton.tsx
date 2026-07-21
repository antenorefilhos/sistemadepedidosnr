interface SkeletonCardProps {
  count?: number
}

function SkeletonItem() {
  return (
    <div className="rounded-xl overflow-hidden bg-white border border-gray-100 animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-5 bg-gray-200 rounded w-1/3 mt-1" />
        <div className="h-8 bg-gray-200 rounded w-full mt-2" />
      </div>
    </div>
  )
}

export function SkeletonCard({ count = 8 }: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonItem key={i} />
      ))}
    </>
  )
}

export function SkeletonHero() {
  return (
    <div className="w-full h-64 md:h-80 bg-gray-200 rounded-xl animate-pulse" />
  )
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}
