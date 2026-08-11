import { useProductRatingsQuery } from '../../../api/ratings';
import { useTheme } from '../../../context/ThemeContext';
import RatingStars from './RatingStars';

interface ProductRatingSummaryProps {
  productId: number;
  showBreakdown?: boolean;
}

export default function ProductRatingSummary({ productId, showBreakdown = false }: ProductRatingSummaryProps) {
  const { darkMode } = useTheme();
  const ratingsQuery = useProductRatingsQuery(productId);

  if (ratingsQuery.isLoading) {
    return <div className="h-6 w-36 animate-pulse rounded bg-gray-300/60" aria-label="Loading product rating" />;
  }

  if (ratingsQuery.isError) {
    return <p className="text-xs text-red-500" role="status">Rating unavailable</p>;
  }

  const summary = ratingsQuery.data?.summary;
  if (!summary || summary.ratingCount === 0) {
    return (
      <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
        No ratings yet
      </p>
    );
  }

  return (
    <div className="space-y-3" aria-label={`${summary.averageScore.toFixed(1)} out of 5 stars from ${summary.ratingCount} ratings`}>
      <div className="flex flex-wrap items-center gap-2">
        <RatingStars value={summary.averageScore} label="Average product rating" size="sm" />
        <span className={`${darkMode ? 'text-gray-200' : 'text-gray-700'} text-sm font-semibold`}>
          {summary.averageScore.toFixed(1)}
        </span>
        <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>
          ({summary.ratingCount} {summary.ratingCount === 1 ? 'rating' : 'ratings'})
        </span>
      </div>

      {showBreakdown && (
        <div className="space-y-1.5" aria-label="Rating breakdown">
          {[5, 4, 3, 2, 1].map((score) => {
            const count = summary.distribution[String(score)] ?? 0;
            const percentage = summary.ratingCount > 0 ? (count / summary.ratingCount) * 100 : 0;
            return (
              <div key={score} className="flex items-center gap-2 text-xs">
                <span className="w-12 text-right">{score} stars</span>
                <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-200'} h-2 flex-1 overflow-hidden rounded-full`}>
                  <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${percentage}%` }} />
                </div>
                <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} w-5 text-right`}>{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
