import axios from 'axios';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import {
  useCartQuery,
  useClearCartMutation,
  useRemoveCartItemMutation,
} from '../../api/cart';
import { api } from '../../api/config';
import { useTheme } from '../../context/ThemeContext';

interface ProductSummary {
  productId: number;
  name: string;
  imgName: string;
}

const fetchProducts = async (): Promise<ProductSummary[]> => {
  const { data } = await axios.get<ProductSummary[]>(`${api.baseURL}${api.endpoints.products}`);
  return data;
};

const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

export default function CartPage() {
  const { darkMode } = useTheme();
  const { data: cart, isLoading: cartLoading, error: cartError } = useCartQuery();
  const { data: products } = useQuery<ProductSummary[]>('products', fetchProducts);
  const removeItemMutation = useRemoveCartItemMutation();
  const clearCartMutation = useClearCartMutation();

  const productsById = new Map(products?.map((product) => [product.productId, product]));

  if (cartLoading) {
    return (
      <div
        className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}
      >
        <div className="max-w-4xl mx-auto flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (cartError) {
    return (
      <div
        className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}
      >
        <div className="max-w-4xl mx-auto">
          <h1
            className={`text-3xl font-bold ${darkMode ? 'text-light' : 'text-gray-800'} mb-6 transition-colors duration-300`}
          >
            Your Cart
          </h1>
          <div className="rounded-lg border border-red-400 bg-red-50 text-red-700 px-4 py-3">
            Failed to load cart items.
          </div>
        </div>
      </div>
    );
  }

  const items = cart?.items ?? [];

  return (
    <div
      className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 pb-16 px-4 transition-colors duration-300`}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1
            className={`text-3xl font-bold ${darkMode ? 'text-light' : 'text-gray-800'} transition-colors duration-300`}
          >
            Your Cart
          </h1>
          <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
            {cart?.itemCount ?? 0} item{(cart?.itemCount ?? 0) === 1 ? '' : 's'}
          </span>
        </div>

        {removeItemMutation.isError && (
          <div className="mb-4 rounded-lg border border-red-400 bg-red-50 text-red-700 px-4 py-3">
            Could not remove item. Please try again.
          </div>
        )}

        {clearCartMutation.isError && (
          <div className="mb-4 rounded-lg border border-red-400 bg-red-50 text-red-700 px-4 py-3">
            Could not clear cart. Please try again.
          </div>
        )}

        {items.length === 0 ? (
          <div
            className={`${darkMode ? 'bg-gray-800 border-gray-700 text-light' : 'bg-white border-gray-200 text-gray-700'} border rounded-lg p-10 text-center shadow-sm transition-colors duration-300`}
          >
            <p className="text-lg font-medium mb-4">Your cart is empty.</p>
            <Link
              to="/products"
              className="inline-flex items-center bg-primary hover:bg-accent text-white px-5 py-2 rounded-md transition-colors"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const product = productsById.get(item.productId);
              const lineTotal = item.price * item.quantity;

              return (
                <article
                  key={item.cartItemId}
                  className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-4 shadow-sm transition-colors duration-300`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div
                      className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} h-20 w-20 rounded-md overflow-hidden flex items-center justify-center shrink-0`}
                    >
                      {product?.imgName ? (
                        <img
                          src={`/${product.imgName}`}
                          alt={product.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>
                          No image
                        </span>
                      )}
                    </div>

                    <div className="flex-grow">
                      <h2 className={`${darkMode ? 'text-light' : 'text-gray-800'} font-semibold text-lg`}>
                        {product?.name ?? `Product #${item.productId}`}
                      </h2>
                      <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                        Quantity: {item.quantity}
                      </p>
                      <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                        Unit price: {formatCurrency(item.price)}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-primary font-semibold text-lg">{formatCurrency(lineTotal)}</p>
                      <button
                        onClick={() => removeItemMutation.mutate(item.productId)}
                        disabled={removeItemMutation.isLoading || clearCartMutation.isLoading}
                        className="mt-2 text-sm text-red-500 hover:text-red-600 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            <div
              className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-4 shadow-sm transition-colors duration-300`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>Subtotal</p>
                  <p className="text-primary text-2xl font-bold">{formatCurrency(cart?.subtotal ?? 0)}</p>
                </div>
                <button
                  onClick={() => clearCartMutation.mutate()}
                  disabled={clearCartMutation.isLoading || removeItemMutation.isLoading}
                  className={`${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-light' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} px-4 py-2 rounded-md transition-colors disabled:opacity-60`}
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}