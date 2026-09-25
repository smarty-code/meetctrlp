export type ShopUserRole = "OWNER" | "MANAGER" | "STAFF";

export type ShopUserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type ShopUser = {
  id: string;
  shopId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: ShopUserRole;
  status: ShopUserStatus;
  lastLoginAt: string | null;
};

export type AuthSessionUser = ShopUser;

export type AuthTokens = {
  idToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type AuthSessionResponse = {
  user: AuthSessionUser;
  tokens: AuthTokens;
};

export type AuthMeResponse = {
  user: AuthSessionUser;
};

export type AuthErrorResponse = {
  error: string;
};

export type RegisterRequest = {
  name: string;
  shopName: string;
  password: string;
  email?: string;
  phone?: string;
};

export type LoginRequest = {
  identifier: string;
  password: string;
};

export type RefreshRequest = {
  refreshToken: string;
};
