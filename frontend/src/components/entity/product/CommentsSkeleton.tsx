/**
 * Comments Loading Skeleton
 * Displays placeholder cards while comments are loading
 */

export const CommentsSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border border-blue-200 dark:border-blue-700 animate-pulse"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="h-4 bg-blue-200 dark:bg-blue-700 rounded w-1/4 mb-2"></div>
            <div className="h-3 bg-blue-200 dark:bg-blue-700 rounded w-1/6"></div>
          </div>
        </div>
        <div className="space-y-2 mb-3">
          <div className="h-3 bg-blue-200 dark:bg-blue-700 rounded"></div>
          <div className="h-3 bg-blue-200 dark:bg-blue-700 rounded w-5/6"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 bg-blue-200 dark:bg-blue-700 rounded w-12"></div>
          <div className="h-6 bg-blue-200 dark:bg-blue-700 rounded w-12"></div>
        </div>
      </div>
    ))}
  </div>
);
