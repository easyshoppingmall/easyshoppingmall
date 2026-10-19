import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}

export interface OrderRecord {
  orderId: string;
  date: string;
  items: CartItem[];
  totalAmount: number;
  deliveryCharge: number;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    paymentMethod: string;
    note?: string;
  };
  status: 'প্রসেসিং' | 'ডেলিভারি চলছে' | 'সম্পন্ন';
}

interface CartState {
  items: CartItem[];
  totalQuantity: number;
  wishlist: string[];
  orders: OrderRecord[];
}

const initialState: CartState = {
  items: [],
  totalQuantity: 0,
  wishlist: [],
  orders: [],
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCartItems: (state, action: PayloadAction<CartItem[]>) => {
      state.items = action.payload;
      state.totalQuantity = action.payload.reduce((total, item) => total + item.quantity, 0);
    },
    setWishlist: (state, action: PayloadAction<string[]>) => {
      state.wishlist = action.payload;
    },
    addToCart: (
      state,
      action: PayloadAction<{
        id: string;
        name: string;
        price: number;
        originalPrice?: number;
        image: string;
        category: string;
        quantity?: number;
        selectedSize?: string;
        selectedColor?: string;
      }>
    ) => {
      const addQty = action.payload.quantity || 1;
      const existing = state.items.find(
        (item) =>
          item.id === action.payload.id &&
          item.selectedSize === action.payload.selectedSize &&
          item.selectedColor === action.payload.selectedColor
      );

      if (existing) {
        existing.quantity += addQty;
      } else {
        state.items.push({
          ...action.payload,
          quantity: addQty,
        });
      }
      state.totalQuantity += addQty;
    },
    updateQuantity: (
      state,
      action: PayloadAction<{ id: string; quantity: number }>
    ) => {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        const diff = action.payload.quantity - item.quantity;
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter((i) => i.id !== action.payload.id);
          state.totalQuantity -= item.quantity;
        } else {
          item.quantity = action.payload.quantity;
          state.totalQuantity += diff;
        }
      }
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      const index = state.items.findIndex((item) => item.id === action.payload);
      if (index !== -1) {
        state.totalQuantity -= state.items[index].quantity;
        state.items.splice(index, 1);
      }
    },
    clearCart: (state) => {
      state.items = [];
      state.totalQuantity = 0;
    },
    clearCustomerState: (state) => {
      state.items = [];
      state.totalQuantity = 0;
      state.wishlist = [];
      state.orders = [];
    },
    toggleWishlist: (state, action: PayloadAction<string>) => {
      const index = state.wishlist.indexOf(action.payload);
      if (index >= 0) {
        state.wishlist.splice(index, 1);
      } else {
        state.wishlist.push(action.payload);
      }
    },
    placeOrder: (state, action: PayloadAction<OrderRecord>) => {
      state.orders.unshift(action.payload);
      state.items = [];
      state.totalQuantity = 0;
    },
  },
});

export const {
  addToCart,
  setCartItems,
  setWishlist,
  updateQuantity,
  removeFromCart,
  clearCart,
  clearCustomerState,
  toggleWishlist,
  placeOrder,
} = cartSlice.actions;

export default cartSlice.reducer;
