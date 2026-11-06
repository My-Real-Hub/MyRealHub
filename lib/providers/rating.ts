export type ProviderRatingFieldErrors = Partial<
  Record<"rating" | "review", string>
>;

export function parseProviderRating(value: string) {
  // A rating is one discrete choice, never a partially parsed number.
  return /^[1-5]$/.test(value) ? Number(value) : Number.NaN;
}

export function validateProviderRating({
  rating,
  review,
}: {
  rating: number;
  review: string;
}): ProviderRatingFieldErrors {
  const fieldErrors: ProviderRatingFieldErrors = {};

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    fieldErrors.rating = "Choose a rating from 1 to 5.";
  }

  if (review.length > 1000) {
    fieldErrors.review = "Review must be 1,000 characters or fewer.";
  }

  return fieldErrors;
}
