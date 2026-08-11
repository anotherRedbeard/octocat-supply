import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { api } from './config';

const RATING_TOKEN_STORAGE_KEY = 'octocat.ratingToken';

export interface Rating {
  ratingId: number;
  productId: number;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface RatingSummary {
  averageScore: number;
  ratingCount: number;
  distribution: Record<string, number>;
}

export interface RatingListResponse {
  ratings: Rating[];
  summary: RatingSummary;
  ownedRating: Rating | null;
}

export interface RatingMutationResponse {
  rating: Rating;
  summary: RatingSummary;
}

export interface RatingRequest {
  score: number;
}

const generateOpaqueRatingToken = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `rating-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

export const getOrCreateRatingToken = (): string => {
  if (typeof window === 'undefined') {
    return 'server-rating-token';
  }

  const existingToken = window.localStorage.getItem(RATING_TOKEN_STORAGE_KEY);
  if (existingToken && existingToken.trim().length > 0) {
    return existingToken;
  }

  const newToken = generateOpaqueRatingToken();
  window.localStorage.setItem(RATING_TOKEN_STORAGE_KEY, newToken);
  return newToken;
};

const getRatingHeaders = () => ({
  'X-Rating-Token': getOrCreateRatingToken(),
});

export const getProductRatingsQueryKey = (productId: number, token: string) => [
  'product-ratings',
  productId,
  token,
] as const;

export const getProductRatings = async (productId: number): Promise<RatingListResponse> => {
  const { data } = await axios.get<RatingListResponse>(
    `${api.baseURL}${api.endpoints.products}/${productId}/ratings`,
    { headers: getRatingHeaders() },
  );
  return data;
};

export const createProductRating = async (
  productId: number,
  request: RatingRequest,
): Promise<RatingMutationResponse> => {
  const { data } = await axios.post<RatingMutationResponse>(
    `${api.baseURL}${api.endpoints.products}/${productId}/ratings`,
    request,
    { headers: getRatingHeaders() },
  );
  return data;
};

export const updateProductRating = async (
  ratingId: number,
  request: RatingRequest,
): Promise<RatingMutationResponse> => {
  const { data } = await axios.put<RatingMutationResponse>(
    `${api.baseURL}${api.endpoints.ratings}/${ratingId}`,
    request,
    { headers: getRatingHeaders() },
  );
  return data;
};

export const deleteProductRating = async (ratingId: number): Promise<void> => {
  await axios.delete(`${api.baseURL}${api.endpoints.ratings}/${ratingId}`, {
    headers: getRatingHeaders(),
  });
};

export const useProductRatingsQuery = (productId: number) => {
  const token = getOrCreateRatingToken();
  return useQuery<RatingListResponse, Error>(
    getProductRatingsQueryKey(productId, token),
    () => getProductRatings(productId),
    {
      enabled: Number.isInteger(productId) && productId > 0,
      staleTime: 10_000,
    },
  );
};

export const useCreateProductRatingMutation = (productId: number) => {
  const queryClient = useQueryClient();
  const token = getOrCreateRatingToken();

  return useMutation<RatingMutationResponse, Error, RatingRequest>(
    (request) => createProductRating(productId, request),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(getProductRatingsQueryKey(productId, token));
      },
    },
  );
};

export const useUpdateProductRatingMutation = (productId: number) => {
  const queryClient = useQueryClient();
  const token = getOrCreateRatingToken();

  return useMutation<RatingMutationResponse, Error, { ratingId: number; request: RatingRequest }>(
    ({ ratingId, request }) => updateProductRating(ratingId, request),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(getProductRatingsQueryKey(productId, token));
      },
    },
  );
};

export const useDeleteProductRatingMutation = (productId: number) => {
  const queryClient = useQueryClient();
  const token = getOrCreateRatingToken();

  return useMutation<void, Error, number>(
    (ratingId) => deleteProductRating(ratingId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(getProductRatingsQueryKey(productId, token));
      },
    },
  );
};
