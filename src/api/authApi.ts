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
  newPassword: string;
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

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
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
}

export interface ReferralOrder {
  _id: string;
  orderId?: string;
  totalAmt?: number;
  order_status?: string;
  payment_status?: string;
  referralBonusAmount?: number;
  referralPercentage?: number;
  createdAt?: string;
  userId?: string | { _id?: string; name?: string; email?: string; image?: string };
}

export interface ProfileDashboard {
  user: UserProfile;
  referrals: {
    count: number;
    users: ReferralUser[];
    orders: ReferralOrder[];
  };
}

// ─── API Functions ──────────────────────────────────────────────────────────

const BASE = '/api/users';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
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
  return {
    ...user,
    phone: user.phone ?? user.mobile ?? '',
    isVerified: user.isVerified ?? user.verify_email,
    role,
  } as UserProfile;
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
    const { data } = await apiClient.post(`${BASE}/reset-password`, payload);
    return normalizeAuthResponse(data);
  },

  /** Get the current logged-in user's profile */
  getProfile: async (): Promise<UserProfile> => {
    const { data } = await apiClient.get(`${BASE}/userprofile`);
    const profile = data?.user ?? data?.data?.user ?? data?.data ?? data;

    if (typeof profile?.role === 'string') {
      profile.role = profile.role.toUpperCase();
    }

    return profile;
  },

  /** Get the authenticated user's profile and backend-provided referral history. */
  getProfileDashboard: async (signal?: AbortSignal): Promise<ProfileDashboard> => {
    const { data } = await apiClient.get(`${BASE}/userprofile`, { signal });
    const response = asRecord(data) ?? {};
    const body = asRecord(response.data) ?? response;
    const profile = normalizeUser(body.user ?? asRecord(body.data)?.user);
    if (!profile) throw new Error('প্রোফাইল তথ্য পাওয়া যায়নি।');

    const referralData = asRecord(body.referrals) ?? {};
    return {
      user: profile,
      referrals: {
        count: Number(referralData.count) || 0,
        users: Array.isArray(referralData.users) ? referralData.users as ReferralUser[] : [],
        orders: Array.isArray(referralData.orders) ? referralData.orders as ReferralOrder[] : [],
      },
    };
  },

  /** Update only fields belonging to the authenticated user's own profile. */
  updateOwnProfile: async (payload: UpdateOwnProfilePayload): Promise<UserProfile> => {
    const { data } = await apiClient.put(`${BASE}/userprofile`, payload);
    const response = asRecord(data) ?? {};
    const body = asRecord(response.data) ?? response;
    const user = normalizeUser(body.user ?? body.profile);
    if (!user) throw new Error('আপডেট করা প্রোফাইল পাওয়া যায়নি।');
    return user;
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
    const { data, headers } = await apiClient.put(`${BASE}/change-password`, payload);
    return normalizeAuthResponse(data, headers.authorization ?? headers['x-auth-token']);
  },
};

export default authApi;
