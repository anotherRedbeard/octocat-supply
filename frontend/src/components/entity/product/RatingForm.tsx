import { useEffect, useState } from 'react';
import {
  useCreateProductRatingMutation,
  useDeleteProductRatingMutation,
  useProductRatingsQuery,
  useUpdateProductRatingMutation,
} from '../../../api/ratings';
import { useTheme } from '../../../context/ThemeContext';
import RatingStars from './RatingStars';

interface RatingFormProps {
  productId: number;
}

export default function RatingForm({ productId }: RatingFormProps) {
  const { darkMode } = useTheme();
  const [score, setScore] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const ratingsQuery = useProductRatingsQuery(productId);
  const createMutation = useCreateProductRatingMutation(productId);
  const updateMutation = useUpdateProductRatingMutation(productId);
  const deleteMutation = useDeleteProductRatingMutation(productId);
  const ownedRating = ratingsQuery.data?.ownedRating ?? null;
  const isMutating = createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;
  const mutationError = createMutation.error || updateMutation.error || deleteMutation.error;

  useEffect(() => {
    if (ownedRating) {
      setScore(ownedRating.score);
      setIsEditing(false);
    }
  }, [ownedRating]);

  const handleScoreChange = (nextScore: number) => {
    setScore(nextScore);
    setValidationMessage('');
    setSuccessMessage('');
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    setValidationMessage('');
    setSuccessMessage('');
  };

  const handleCancelEditing = () => {
    if (ownedRating) {
      setScore(ownedRating.score);
    }
    setIsEditing(false);
    setValidationMessage('');
    setSuccessMessage('');
  };

  const handleSubmit = () => {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      setValidationMessage('Choose a score from 1 to 5 stars.');
      return;
    }

    setValidationMessage('');
    setSuccessMessage('');
    const request = { score };
    const options = {
      onSuccess: () => {
        setSuccessMessage(isEditing ? 'Your rating was updated.' : 'Your rating was submitted.');
      },
    };

    if (ownedRating && isEditing) {
      updateMutation.mutate({ ratingId: ownedRating.ratingId, request }, options);
    } else {
      createMutation.mutate(request, options);
    }
  };

  const handleDelete = () => {
    if (!ownedRating) {
      return;
    }

    setSuccessMessage('');
    deleteMutation.mutate(ownedRating.ratingId, {
      onSuccess: () => {
        setScore(0);
        setSuccessMessage('Your rating was removed.');
      },
    });
  };

  if (ratingsQuery.isLoading) {
    return (
      <section className={`${darkMode ? 'bg-gray-900 text-light' : 'bg-gray-50 text-gray-800'} rounded-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'} p-4`} aria-busy="true">
        <p className="text-sm">Loading rating controls...</p>
      </section>
    );
  }

  if (ratingsQuery.isError) {
    return (
      <section className="rounded-lg border border-red-400 bg-red-50 p-4 text-red-700" role="alert">
        <p>Ratings are temporarily unavailable. Please try again.</p>
      </section>
    );
  }

  return (
    <section
      className={`${darkMode ? 'bg-gray-900 text-light border-gray-700' : 'bg-gray-50 text-gray-800 border-gray-200'} rounded-lg border p-4 shadow-sm`}
      aria-labelledby={`rating-form-title-${productId}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`rating-form-title-${productId}`} className="font-semibold">
            {isEditing ? 'Your rating' : 'Rate this product'}
          </h3>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1 text-sm`}>
            {isEditing ? 'Update your score any time.' : 'Share a quick score to help other shoppers.'}
          </p>
        </div>
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
          1-5 stars
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {ownedRating && !isEditing ? (
          <RatingStars value={ownedRating.score} label="Your product rating" size="lg" />
        ) : (
          <RatingStars
            value={score}
            onChange={handleScoreChange}
            disabled={isMutating}
            label="Choose a product score"
            size="lg"
          />
        )}
        <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} text-sm`}>
          {ownedRating && !isEditing
            ? `${ownedRating.score} out of 5`
            : score > 0
              ? `${score} out of 5`
              : 'Select a score'}
        </span>
      </div>

      {validationMessage && <p className="mt-3 text-sm text-red-500" role="alert">{validationMessage}</p>}
      {mutationError && <p className="mt-3 text-sm text-red-500" role="alert">{mutationError.message || 'Could not save your rating.'}</p>}
      {successMessage && <p className="mt-3 text-sm text-primary" role="status">{successMessage}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {ownedRating && !isEditing ? (
          <button
            type="button"
            onClick={handleStartEditing}
            disabled={isMutating}
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Update rating
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isMutating}
              className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isMutating ? 'Saving...' : ownedRating ? 'Save rating' : 'Submit rating'}
            </button>
            {ownedRating && (
              <button
                type="button"
                onClick={handleCancelEditing}
                disabled={isMutating}
                className={`${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-white'} rounded-lg border px-4 py-2 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Cancel
              </button>
            )}
          </>
        )}
        {ownedRating && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isMutating}
            className={`${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-white'} rounded-lg border px-4 py-2 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60`}
          >
            Remove rating
          </button>
        )}
      </div>
    </section>
  );
}
