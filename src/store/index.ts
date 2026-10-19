import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
  isAnyOf,
} from '@reduxjs/toolkit';
import { queryClient } from '../config/queryClient';
import cartReducer, { clearCustomerState } from './cartSlice';
import authReducer, { signIn, signOut } from './authSlice';

const rootReducer = combineReducers({
  cart: cartReducer,
  auth: authReducer,
});

type ListenerRootState = ReturnType<typeof rootReducer>;
const authLifecycleMiddleware = createListenerMiddleware<ListenerRootState>();

authLifecycleMiddleware.startListening({
  matcher: isAnyOf(signOut.fulfilled, signOut.rejected),
  effect: (_action, { dispatch }) => {
    dispatch(clearCustomerState());
    queryClient.clear();
  },
});

authLifecycleMiddleware.startListening({
  actionCreator: signIn.fulfilled,
  effect: (action, listenerApi) => {
    const previousUserId = listenerApi.getOriginalState().auth.user?._id;
    const currentUserId = action.payload.user?._id;
    if (previousUserId === currentUserId) return;

    listenerApi.dispatch(clearCustomerState());
    queryClient.clear();
  },
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).prepend(authLifecycleMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
