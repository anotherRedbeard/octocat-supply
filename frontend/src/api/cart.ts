import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { api } from './config';

const CART_KEY_STORAGE_KEY = 'octocat.cartKey';

export interface CartItem {
  cartItemId: number;
  cartId: number;
  productId: number;
  quantity: number;
  price: number;
}

export interface CartResponse {
  cartKey: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
}

export interface AddCartItemRequest {
  productId: number;
  quantity: number;
}

const generateOpaqueCartKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `cart-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

export const getOrCreateCartKey = (): string => {
  if (typeof window === 'undefined') {
    return 'server-cart';
  }

  const existingKey = window.localStorage.getItem(CART_KEY_STORAGE_KEY);
  if (existingKey && existingKey.trim().length > 0) {
    return existingKey;
  }

  const newKey = generateOpaqueCartKey();
  window.localStorage.setItem(CART_KEY_STORAGE_KEY, newKey);
  return newKey;
};

const getCartHeaders = () => ({
  'X-Cart-Key': getOrCreateCartKey(),
});

export const getCartQueryKey = (cartKey: string) => ['cart', cartKey] as const;

export const getCart = async (): Promise<CartResponse> => {
  const { data } = await axios.get<CartResponse>(`${api.baseURL}${api.endpoints.cart}`, {
    headers: getCartHeaders(),
  });
  return data;
};

export const addCartItem = async (payload: AddCartItemRequest): Promise<CartResponse> => {
  const { data } = await axios.post<CartResponse>(`${api.baseURL}${api.endpoints.cart}/items`, payload, {
    headers: getCartHeaders(),
  });
  return data;
};

export const removeCartItem = async (productId: number): Promise<CartResponse> => {
  const { data } = await axios.delete<CartResponse>(
    `${api.baseURL}${api.endpoints.cart}/items/${productId}`,
    {
      headers: getCartHeaders(),
    },
  );
  return data;
};

export const clearCart = async (): Promise<CartResponse> => {
  const { data } = await axios.delete<CartResponse>(`${api.baseURL}${api.endpoints.cart}`, {
    headers: getCartHeaders(),
  });
  return data;
};

export const useCartQuery = () => {
  const cartKey = getOrCreateCartKey();
  return useQuery<CartResponse, Error>(getCartQueryKey(cartKey), getCart, {
    staleTime: 10_000,
  });
};

export const useAddCartItemMutation = () => {
  const queryClient = useQueryClient();
  const cartKey = getOrCreateCartKey();

  return useMutation<CartResponse, Error, AddCartItemRequest>(addCartItem, {
    onSuccess: () => {
      queryClient.invalidateQueries(getCartQueryKey(cartKey));
    },
  });
};

export const useRemoveCartItemMutation = () => {
  const queryClient = useQueryClient();
  const cartKey = getOrCreateCartKey();

  return useMutation<CartResponse, Error, number>(removeCartItem, {
    onSuccess: () => {
      queryClient.invalidateQueries(getCartQueryKey(cartKey));
    },
  });
};

export const useClearCartMutation = () => {
  const queryClient = useQueryClient();
  const cartKey = getOrCreateCartKey();

  return useMutation<CartResponse, Error>(clearCart, {
    onSuccess: () => {
      queryClient.invalidateQueries(getCartQueryKey(cartKey));
    },
  });
};