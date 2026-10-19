import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  authApi,
  UserProfile,
  SignUpPayload,
  SignInPayload,
  ChangePasswordPayload,
} from '../api/authApi';
import { apiClient } from '../api/client';

// ─── Constants ──────────────────────────────────────────────────────────────

const TOKEN_KEY = 'esm_auth_token';
const TOKEN_EXPIRY_KEY = 'esm_token_expiry';
const COOKIE_SESSION_KEY = 'esm_cookie_session';

// ─── State ──────────────────────────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean; // hydration done?
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function persistToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.deleteItemAsync(COOKIE_SESSION_KEY);
  await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
}

async function persistCookieSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.setItemAsync(COOKIE_SESSION_KEY, 'true');
  await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
}

async function clearPersistedToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(COOKIE_SESSION_KEY);
  await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
}

function attachTokenToClient(token: string) {
  const normalizedToken = token.trim().replace(/^Bearer\s+/i, '');
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${normalizedToken}`;
}

function detachTokenFromClient() {
  delete apiClient.defaults.headers.common['Authorization'];
}

// ─── Async Thunks ───────────────────────────────────────────────────────────

function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const responseMessage = getBackendMessage(error.response?.data);
    if (responseMessage) return responseMessage;
    if (error.response?.status === 401) {
      return 'ইমেইল/মোবাইল নম্বর অথবা পাসওয়ার্ড সঠিক নয়';
    }
  }

  return error instanceof Error ? error.message : fallback;
}

function getBackendMessage(value: unknown, depth = 0): string | undefined {
  if (depth > 4) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value !== 'object' || value === null) return undefined;

  const record = value as Record<string, unknown>;
  for (const key of ['message', 'error']) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    const nestedMessage = getBackendMessage(candidate, depth + 1);
    if (nestedMessage) return nestedMessage;
  }
  for (const key of ['data', 'response', 'errors']) {
    const nestedMessage = getBackendMessage(record[key], depth + 1);
    if (nestedMessage) return nestedMessage;
  }
  return undefined;
}

/** Restore token from SecureStore on app launch */
export const hydrateAuth = createAsyncThunk('auth/hydrate', async (_, { rejectWithValue }) => {
  try {
    const [token, cookieSession] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(COOKIE_SESSION_KEY),
    ]);
    if (!token && cookieSession !== 'true') {
      await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
      return null;
    }

    if (token) attachTokenToClient(token);
    else detachTokenFromClient();
    const user = await authApi.getProfile();
    return { token, user };
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (status === 401) {
      await clearPersistedToken();
      detachTokenFromClient();
      return null;
    }
    return rejectWithValue(
      getAuthErrorMessage(error, 'প্রোফাইল লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।')
    );
  }
});

/** Sign up a new user */
export const signUp = createAsyncThunk(
  'auth/signUp',
  async (payload: SignUpPayload, { rejectWithValue }) => {
    try {
      const res = await authApi.signUp(payload);
      if (!res.success) return rejectWithValue(res.message || 'সাইন আপ ব্যর্থ হয়েছে');
      return res;
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error, 'সাইন আপ ব্যর্থ হয়েছে'));
    }
  }
);

/** Sign in with email and password */
export const signIn = createAsyncThunk(
  'auth/signIn',
  async (payload: SignInPayload, { rejectWithValue }) => {
    let sessionPersisted = false;
    try {
      const res = await authApi.signIn(payload);
      if (!res.success) return rejectWithValue(res.message || 'লগইন ব্যর্থ হয়েছে');
      if (res.token) {
        await persistToken(res.token);
        attachTokenToClient(res.token);
      } else {
        await persistCookieSession();
        detachTokenFromClient();
      }
      sessionPersisted = true;
      res.user = res.token && res.user ? res.user : await authApi.getProfile();
      return res;
    } catch (error) {
      if (sessionPersisted) {
        await clearPersistedToken();
        detachTokenFromClient();
      }
      return rejectWithValue(getAuthErrorMessage(error, 'লগইন ব্যর্থ হয়েছে'));
    }
  }
);

/** Sign out */
export const signOut = createAsyncThunk('auth/signOut', async (_, { rejectWithValue }) => {
  let failure: string | null = null;
  try {
    await authApi.signOut();
  } catch (error) {
    failure = getAuthErrorMessage(error, 'সার্ভার থেকে সাইন আউট করা যায়নি');
  }
  await clearPersistedToken();
  detachTokenFromClient();
  if (failure) return rejectWithValue(failure);
});

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (payload: ChangePasswordPayload, { rejectWithValue }) => {
    try {
      const response = await authApi.changePassword(payload);
      if (!response.success || !response.token) {
        return rejectWithValue(response.message || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।');
      }
      await persistToken(response.token);
      attachTokenToClient(response.token);
      return response.token;
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error, 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।'));
    }
  }
);

// ─── Slice ──────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    updateCurrentUser(state, action: { payload: UserProfile }) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    // ── Hydrate ────────────────────────────
    builder
      .addCase(hydrateAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(hydrateAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        if (action.payload) {
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.isAuthenticated = true;
        } else {
          state.token = null;
          state.user = null;
          state.isAuthenticated = false;
        }
      })
      .addCase(hydrateAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.token = null;
        state.user = null;
        state.isAuthenticated = false;
        state.error = (action.payload as string) || null;
      });

    // ── Sign Up ────────────────────────────
    builder
      .addCase(signUp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(signUp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || 'সাইন আপ ব্যর্থ হয়েছে';
      });

    // ── Sign In ────────────────────────────
    builder
      .addCase(signIn.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.token = action.payload.token ?? null;
        if (action.payload.user) state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || 'লগইন ব্যর্থ হয়েছে';
      });

    // ── Sign Out ───────────────────────────
    builder.addCase(signOut.fulfilled, (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    });
    builder.addCase(signOut.rejected, (state, action) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.error = (action.payload as string) || 'সার্ভার থেকে সাইন আউট করা যায়নি';
    });
    builder.addCase(changePassword.fulfilled, (state, action) => {
      state.token = action.payload;
      state.error = null;
    });
  },
});

export const { clearError, updateCurrentUser } = authSlice.actions;
export default authSlice.reducer;
