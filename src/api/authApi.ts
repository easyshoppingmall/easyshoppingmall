import { isAxiosError } from 'axios';
import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export type UserRole = 'USER' | 'DROPSHIPPING';

export interface SignUpPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  referralCode?: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SendOtpPayload {
  email: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  newPassword?: string;
  newpassword?: string;
  password?: string;
}

export interface UpdateOwnProfilePayload {
  name: string;
  mobile: string;
  date_of_birth: string | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  shopName?: string;
  shopAddress?: string;
  shopWebsite?: string;
  facebookPage?: string;
  whatsappNumber?: string;
  paymentDetails?: {
    bkash: string;
    nagad: string;
    rocket: string;
    bank: string;
  };
}

export interface UpdateDropshippingShopSettingsPayload {
  shopName: string;
  shopAddress: string;
  shopWebsite: string;
  facebookPage: string;
  whatsappNumber: string;
  paymentDetails: {
    bkash: string;
    nagad: string;
    rocket: string;
    bank: string;
  };
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  newpassword?: string;
  password?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: UserProfile;
  error?: string;
}

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone: string;
  mobile?: string | null;
  role: UserRole;
  image?: string;
  shopLogo?: string | null;
  isVerified?: boolean;
  referralCode?: string;
  referralCount?: number;
  balance?: number;
  date_of_birth?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | null;
  shopName?: string | null;
  shopAddress?: string | null;
  shopWebsite?: string | null;
  facebookPage?: string | null;
  whatsappNumber?: string | null;
  paymentDetails?: {
    bkash?: string | null;
    nagad?: string | null;
    rocket?: string | null;
    bank?: string | null;
  } | null;
  [key: string]: unknown;
}

export interface ReferralUser {
  _id: string;
  name?: string;
  email?: string;
  image?: string;
  createdAt?: string;
  status?: string;
}

export interface ReferralOrder {
  _id: string;
  orderId?: string;
  totalAmt?: number | string;
  order_status?: string;
  payment_status?: string;
  referralBonusAmount?: number | string;
  referralPercentage?: number | string;
  createdAt?: string;
  userId?: string | { _id?: string; name?: string; email?: string; image?: string };
}

export interface ProfileDashboard {
  user: UserProfile;
  referrals: {
    count?: number;
    users?: ReferralUser[];
    orders?: ReferralOrder[];
  };
}

// ─── API Functions ──────────────────────────────────────────────────────────

const BASE = '/api/users';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function parseReferralUsers(value: unknown): ReferralUser[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error('সার্ভার থেকে রেফারেল সদস্যের সঠিক তালিকা পাওয়া যায়নি।');
  }
  return value.map((item) => {
    const user = asRecord(item);
    if (!user || typeof user._id !== 'string' || !user._id.trim()) {
      throw new Error('সার্ভার থেকে রেফারেল সদস্যের সঠিক তথ্য পাওয়া যায়নি।');
    }
    return {
      _id: user._id,
      ...(typeof user.name === 'string' ? { name: user.name } : {}),
      ...(typeof user.email === 'string' ? { email: user.email } : {}),
      ...(typeof user.image === 'string' ? { image: user.image } : {}),
      ...(typeof user.createdAt === 'string' ? { createdAt: user.createdAt } : {}),
      ...(typeof user.status === 'string' ? { status: user.status } : {}),
    };
  });
}

function parseReferralOrders(value: unknown): ReferralOrder[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error('সার্ভার থেকে রেফারেল অর্ডারের সঠিক তালিকা পাওয়া যায়নি।');
  }
  return value.map((item) => {
    const order = asRecord(item);
    if (!order || typeof order._id !== 'string' || !order._id.trim()) {
      throw new Error('সার্ভার থেকে রেফারেল অর্ডারের সঠিক তথ্য পাওয়া যায়নি।');
    }
    const parsed: ReferralOrder = { _id: order._id };
    for (const key of ['orderId', 'order_status', 'payment_status', 'createdAt'] as const) {
      const field = order[key];
      if (typeof field === 'string') parsed[key] = field;
    }
    for (const key of ['totalAmt', 'referralBonusAmount', 'referralPercentage'] as const) {
      const field = order[key];
      if (typeof field === 'number' && Number.isFinite(field)) {
        parsed[key] = field;
      } else if (typeof field === 'string' && field.trim() && Number.isFinite(Number(field))) {
        parsed[key] = field;
      }
    }
    if (typeof order.userId === 'string') {
      parsed.userId = order.userId;
    } else if (order.userId !== undefined && order.userId !== null) {
      const user = asRecord(order.userId);
      if (!user) throw new Error('সার্ভার থেকে রেফারেল অর্ডারের সদস্যতথ্য সঠিক নয়।');
      parsed.userId = {
        ...(typeof user._id === 'string' ? { _id: user._id } : {}),
        ...(typeof user.name === 'string' ? { name: user.name } : {}),
        ...(typeof user.email === 'string' ? { email: user.email } : {}),
        ...(typeof user.image === 'string' ? { image: user.image } : {}),
      };
    }
    return parsed;
  });
}

function normalizeToken(value: string): string {
  return value.trim().replace(/^Bearer\s+/i, '');
}

function getCookieToken(value: unknown): string | undefined {
  const headers = Array.isArray(value) ? value : [value];
  for (const header of headers) {
    if (typeof header !== 'string') continue;
    const match = header.match(/(?:^|[,;]\s*)token=([^;,\s]+)/i);
    if (match?.[1]) return normalizeToken(match[1]);
  }
  return undefined;
}

function getToken(value: unknown, depth = 0): string | undefined {
  if (depth > 8) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedToken = getToken(item, depth + 1);
      if (nestedToken) return nestedToken;
    }
    return undefined;
  }

  const record = asRecord(value);
  if (!record) return undefined;

  const tokenKeys = new Set([
    'token',
    'accesstoken',
    'authtoken',
    'usertoken',
    'jwt',
    'authorization',
    'xauthtoken',
    'xaccesstoken',
  ]);
  for (const [key, candidate] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
    if (tokenKeys.has(normalizedKey) && typeof candidate === 'string' && candidate.trim()) {
      const token = normalizeToken(candidate);
      if (token) return token;
    }
  }

  for (const candidate of Object.values(record)) {
    const nestedToken = getToken(candidate, depth + 1);
    if (nestedToken) return nestedToken;
  }

  return undefined;
}

function normalizeUser(value: unknown): UserProfile | undefined {
  const user = asRecord(value);
  if (!user) return undefined;

  const role = typeof user.role === 'string' ? user.role.toUpperCase() : user.role;
  const balance =
    typeof user.balance === 'number'
      ? user.balance
      : typeof user.balance === 'string' && user.balance.trim()
        ? Number(user.balance)
        : undefined;
  return {
    ...user,
    phone: user.phone ?? user.mobile ?? '',
    isVerified: user.isVerified ?? user.verify_email,
    balance: balance !== undefined && Number.isFinite(balance) ? balance : undefined,
    role,
  } as UserProfile;
}

function responseBody(value: unknown): Record<string, unknown> {
  const response = asRecord(value) ?? {};
  return asRecord(response.data) ?? response;
}

function responseProfile(value: unknown): UserProfile | undefined {
  const response = asRecord(value);
  const body = responseBody(value);
  const nestedData = asRecord(body.data);
  return normalizeUser(
    body.user ??
      body.profile ??
      body.updatedUser ??
      nestedData?.user ??
      nestedData?.profile ??
      (body._id ? body : undefined) ??
      (response?._id ? response : undefined)
  );
}

function throwIfApiFailure(value: unknown, fallback: string): void {
  const response = asRecord(value);
  const body = responseBody(value);
  if (response?.success === false || body.success === false) {
    const message = body.message ?? body.error ?? response?.message;
    throw new Error(typeof message === 'string' && message.trim() ? message : fallback);
  }
}

function isProfileUpdateRouteNotFound(error: unknown): boolean {
  if (!isAxiosError(error) || error.response?.status !== 404) return false;
  const response = asRecord(error.response.data);
  const responseText = typeof error.response.data === 'string' ? error.response.data : '';
  const serverMessage =
    typeof response?.message === 'string' ? response.message : responseText;
  return !serverMessage || /cannot\s+(put|patch)\s+\/api\/users\/userprofile/i.test(serverMessage);
}

function profileUpdateRouteError(): Error {
  return new Error(
    'প্রোফাইল/শপ আপডেট করা যায়নি: সার্ভারে PUT /api/users/userprofile route পাওয়া যায়নি (404)। Backend-এ এই route deploy/enable করতে হবে।'
  );
}

async function putProfileFields(
  payload: UpdateOwnProfilePayload | UpdateDropshippingShopSettingsPayload
): Promise<UserProfile> {
  let data: unknown;
  try {
    const response = await apiClient.put(`${BASE}/userprofile`, payload);
    data = response.data;
  } catch (error) {
    if (isProfileUpdateRouteNotFound(error)) throw profileUpdateRouteError();
    throw error;
  }

  throwIfApiFailure(data, 'প্রোফাইলের তথ্য সংরক্ষণ করা যায়নি।');
  const updatedProfile = responseProfile(data);
  return updatedProfile ?? authApi.getProfile();
}

function normalizeAuthResponse(value: unknown, authorizationHeader?: unknown): AuthResponse {
  const outer = asRecord(value) ?? {};
  const body = asRecord(outer.data) ?? outer;
  const headerToken =
    typeof authorizationHeader === 'string' && !/^token=/i.test(authorizationHeader.trim())
      ? normalizeToken(authorizationHeader)
      : getCookieToken(authorizationHeader);

  return {
    success: body.success !== false && outer.success !== false,
    message:
      typeof body.message === 'string'
        ? body.message
        : typeof outer.message === 'string'
          ? outer.message
          : undefined,
    token:
      getToken(body) ??
      getToken(outer) ??
      headerToken ??
      getCookieToken(authorizationHeader),
    user: normalizeUser(body.user ?? outer.user),
    error:
      typeof body.error === 'string'
        ? body.error
        : typeof outer.error === 'string'
          ? outer.error
          : undefined,
  };
}

export const authApi = {
  /** Create a new user account */
  signUp: async (payload: SignUpPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post(`${BASE}/signup`, payload);
    return normalizeAuthResponse(data);
  },

  /** User login with email and password */
  signIn: async (payload: SignInPayload): Promise<AuthResponse> => {
    const response = await apiClient.post(`${BASE}/signin`, {
      email: payload.email.trim(),
      password: payload.password,
    });
    return normalizeAuthResponse(
      response.data,
      response.headers['authorization'] ??
        response.headers['x-auth-token'] ??
        response.headers['x-access-token'] ??
        response.headers['token'] ??
        response.headers['set-cookie']
    );
  },

  /** Sign out – invalidate session/token */
  signOut: async (): Promise<{ success: boolean }> => {
    const { data } = await apiClient.get(`${BASE}/signout`);
    return data;
  },

  /** Send OTP for verification / password reset */
  sendOtp: async (payload: SendOtpPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post(`${BASE}/send-otp`, payload);
    return normalizeAuthResponse(data);
  },

  /** Verify the OTP code */
  verifyOtp: async (payload: VerifyOtpPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post(`${BASE}/verify-otp`, payload);
    return normalizeAuthResponse(data);
  },

  /** Reset password with OTP */
  resetPassword: async (payload: ResetPasswordPayload): Promise<AuthResponse> => {
    const password = (payload.newPassword || payload.newpassword || payload.password || '').trim();
    const { data } = await apiClient.post(`${BASE}/reset-password`, {
      email: payload.email.trim(),
      otp: payload.otp.trim(),
      newpassword: password,
      newPassword: password,
      password: password,
    });
    return normalizeAuthResponse(data);
  },

  /** Get the current logged-in user's profile */
  getProfile: async (): Promise<UserProfile> => {
    const { data } = await apiClient.get(`${BASE}/userprofile`);
    throwIfApiFailure(data, 'প্রোফাইল তথ্য আনা যায়নি।');
    const profile = responseProfile(data);
    if (!profile) throw new Error('প্রোফাইল তথ্য পাওয়া যায়নি।');
    return profile;
  },

  /** Get the authenticated user's profile and backend-provided referral history. */
  getProfileDashboard: async (signal?: AbortSignal): Promise<ProfileDashboard> => {
    const { data } = await apiClient.get(`${BASE}/userprofile`, { signal });
    throwIfApiFailure(data, 'প্রোফাইল তথ্য আনা যায়নি।');
    const body = responseBody(data);
    const profile = responseProfile(data);
    if (!profile) throw new Error('প্রোফাইল তথ্য পাওয়া যায়নি।');

    const referralData =
      asRecord(body.referrals) ??
      asRecord(asRecord(body.data)?.referrals) ??
      {};
    const referralCountValue = referralData.count;
    const referralCount =
      typeof referralCountValue === 'number'
        ? referralCountValue
        : typeof referralCountValue === 'string' && referralCountValue.trim()
          ? Number(referralCountValue)
          : undefined;
    if (
      referralCount !== undefined &&
      (!Number.isFinite(referralCount) || referralCount < 0)
    ) {
      throw new Error('সার্ভার থেকে রেফারেল সদস্যের সঠিক সংখ্যা পাওয়া যায়নি।');
    }
    return {
      user: profile,
      referrals: {
        count: referralCount,
        users: parseReferralUsers(referralData.users),
        orders: parseReferralOrders(referralData.orders),
      },
    };
  },

  /** Update only fields belonging to the authenticated user's own profile. */
  updateOwnProfile: async (payload: UpdateOwnProfilePayload): Promise<UserProfile> => {
    return putProfileFields(payload);
  },

  /** Save only Dropshipping shop/payment fields, separately from personal profile edits. */
  updateDropshippingShopSettings: async (
    payload: UpdateDropshippingShopSettingsPayload
  ): Promise<UserProfile> => {
    return putProfileFields(payload);
  },

  requestEmailChange: async (email: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post(`${BASE}/userprofile/email-change/request`, { email });
    return normalizeAuthResponse(data);
  },

  verifyEmailChange: async (otp: string): Promise<UserProfile> => {
    const { data } = await apiClient.post(`${BASE}/userprofile/email-change/verify`, { otp });
    const response = asRecord(data) ?? {};
    const body = asRecord(response.data) ?? response;
    const user = normalizeUser(body.user ?? body.profile);
    if (!user) throw new Error('যাচাইকৃত প্রোফাইল পাওয়া যায়নি।');
    return user;
  },

  /** Change the authenticated user's password and return the replacement session token. */
  changePassword: async (payload: ChangePasswordPayload): Promise<AuthResponse> => {
    const password = (payload.newPassword || payload.newpassword || payload.password || '').trim();
    const { data, headers } = await apiClient.put(`${BASE}/change-password`, {
      currentPassword: payload.currentPassword,
      oldPassword: payload.currentPassword,
      newpassword: password,
      newPassword: password,
      password: password,
    });
    return normalizeAuthResponse(data, headers?.authorization ?? headers?.['x-auth-token']);
  },
};

export default authApi;
