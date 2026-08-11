import type { MouseEvent, KeyboardEvent } from 'react';

interface RatingStarsProps {
  value: number;
  onChange?: (score: number) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

function StarIcon({ filled, className }: { filled: boolean; className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`${className} transition-colors duration-200`}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 2.78 5.63 6.22.9-4.5 4.38 1.06 6.19L12 17.18l-5.56 2.92 1.06-6.19L3 9.53l6.22-.9L12 3Z" />
    </svg>
  );
}

export default function RatingStars({
  value,
  onChange,
  disabled = false,
  label = 'Product rating',
  size = 'md',
}: RatingStarsProps) {
  const isInteractive = typeof onChange === 'function';
  const normalizedValue = Math.max(0, Math.min(5, value));
  const starClass = sizeClasses[size];

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, score: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChange?.(score);
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>, score: number) => {
    event.preventDefault();
    onChange?.(score);
  };

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role={isInteractive ? 'radiogroup' : undefined}
      aria-label={`${label}: ${normalizedValue} out of 5`}
    >
      {Array.from({ length: 5 }, (_, starIndex) => {
        const score = starIndex + 1;
        const filled = score <= normalizedValue;
        const star = <StarIcon filled={filled} className={starClass} />;

        if (!isInteractive) {
          return (
            <span key={score} className={filled ? 'text-amber-400' : 'text-gray-400'}>
              {star}
            </span>
          );
        }

        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={score === normalizedValue}
            aria-label={`${label}: ${score} out of 5`}
            disabled={disabled}
            onClick={(event) => handleClick(event, score)}
            onKeyDown={(event) => handleKeyDown(event, score)}
            className={`rounded-sm p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              filled ? 'text-amber-400' : 'text-gray-400'
            } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:text-amber-300'}`}
          >
            {star}
          </button>
        );
      })}
      <span className="sr-only">{normalizedValue} out of 5 stars</span>
    </div>
  );
}
