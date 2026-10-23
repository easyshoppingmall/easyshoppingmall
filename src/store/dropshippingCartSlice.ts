import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DropshippingProduct } from '../features/dropshipping/api/homeApi';

export interface DropshippingCartItem {
  key: string;
  product: DropshippingProduct;
  quantity: number;
  size: string;
  color: string;
  weight: string;
  sellingPrice: string;
}

interface DropshippingCartState {
  items: DropshippingCartItem[];
}

const initialState: DropshippingCartState = { items: [] };

function cartItemKey(item: Pick<DropshippingCartItem, 'product' | 'size' | 'color' | 'weight'>): string {
  return [item.product.id, item.size, item.color, item.weight].join(':');
}

const dropshippingCartSlice = createSlice({
  name: 'dropshippingCart',
  initialState,
  reducers: {
    addDropshippingCartItem: (
      state,
      action: PayloadAction<{
        product: DropshippingProduct;
        size: string;
        color: string;
        weight: string;
      }>
    ) => {
      const key = cartItemKey(action.payload);
      const current = state.items.find((item) => item.key === key);
      const suggestedSellingPrice =
        action.payload.product.productRank ?? action.payload.product.dropshippingPrice;
      if (current) {
        current.quantity += 1;
        current.product = action.payload.product;
        if (!current.sellingPrice.trim() && suggestedSellingPrice !== undefined) {
          current.sellingPrice = String(suggestedSellingPrice);
        }
        return;
      }
      state.items.push({
        ...action.payload,
        key,
        quantity: 1,
        sellingPrice: suggestedSellingPrice === undefined ? '' : String(suggestedSellingPrice),
      });
    },
    updateDropshippingCartItem: (
      state,
      action: PayloadAction<{ key: string; changes: Partial<Pick<DropshippingCartItem, 'quantity' | 'sellingPrice'>> }>
    ) => {
      const item = state.items.find((entry) => entry.key === action.payload.key);
      if (item) Object.assign(item, action.payload.changes);
    },
    removeDropshippingCartItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.key !== action.payload);
    },
    clearDropshippingCart: (state) => {
      state.items = [];
    },
  },
});

export const {
  addDropshippingCartItem,
  updateDropshippingCartItem,
  removeDropshippingCartItem,
  clearDropshippingCart,
} = dropshippingCartSlice.actions;

export default dropshippingCartSlice.reducer;
