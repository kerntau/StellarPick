export type Role = 'guest' | 'member' | 'merchant' | 'support' | 'admin';

export interface User {
  id: number;
  username?: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  level?: string;
  phone?: string;
  status?: string;
  createdAt?: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  avgRating?: number;
  requestId?: string;
}

export interface Category {
  slug: string;
  name: string;
  icon: string;
  count: number;
  description?: string;
}

export interface Product {
  id: number;
  category?: string;
  title: string;
  subtitle: string;
  price: number;
  stock: number;
  image: string;
  images?: string[];
  categoryId?: string;
  categoryName?: string;
  rating: number;
  sales: number;
  specs?: { name: string; value: string }[];
  description?: string;
}

export interface ProductQuery {
  q?: string;
  category?: string;
  sort?: string;
  page?: number;
  size?: number;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  inStock?: boolean;
}

export interface CartItem {
  id: number;
  productId: number;
  title: string;
  image: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  subtotal: number;
}

export interface Cart {
  items: CartItem[];
  total: number;
  count: number;
}

export interface OrderItem {
  productId: number;
  title: string;
  image: string;
  unitPrice: number;
  quantity: number;
  subtotal?: number;
}

export interface Address {
  id: number;
  name: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
}

export interface OrderAddress {
  recipient: string;
  phone: string;
  region: string;
  detail: string;
}

export interface Order {
  id: number;
  ownerId?: number;
  ownerName?: string;
  ownerEmail?: string;
  ownerUsername?: string;
  status: string;
  statusText: string;
  createdAt: string;
  total: number;
  items: OrderItem[];
  itemCount?: number;
  cover?: string | null;
  address?: OrderAddress;
  shipping?: string;
  invoice?: string;
  trackingNo?: string;
  timeline?: { status: string; label: string; at: string | null }[];
  paidAt?: string | null;
  shippedAt?: string | null;
  completedAt?: string | null;
}

export interface Review {
  id: number;
  productId: number;
  userName: string;
  avatar?: string;
  rating: number;
  body: string;
  createdAt: string;
}

export interface AdminUser {
  id: number;
  username: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  createdAt: string;
  orders?: number;
}

export interface Merchant {
  id: number;
  name: string;
  contact: string;
  phone: string;
  license: string;
  category: string;
  status: string;
  statusText?: string;
  ownerName?: string;
  ownerEmail?: string;
  appliedAt: string;
  createdAt?: string;
  reason?: string;
}

export interface MerchantProduct {
  id: number;
  title: string;
  price: number;
  stock: number;
  status: string;
  image: string;
  sales: number;
  category: string;
}

export interface MerchantOrder {
  id: number;
  buyerName: string;
  recipient?: string;
  phone?: string;
  region?: string;
  detail?: string;
  total: number;
  status: string;
  statusText: string;
  createdAt: string;
  trackingNo?: string;
  items: OrderItem[];
}

export interface Ticket {
  id: number;
  subject: string;
  status: string;
  statusText: string;
  createdAt: string;
  updatedAt: string;
  userName: string;
  lastMessage: string;
  messageCount?: number;
  userId?: number;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: number;
  author: string;
  role: string;
  body: string;
  createdAt: string;
}

export interface Coupon {
  id: number;
  title: string;
  amount: number;
  minSpend: number;
  expiresAt: string;
  used: boolean;
  description?: string;
  type?: string;
  value?: number;
}

export interface ApiError {
  code?: string;
  message: string;
  requestId?: string;
  status?: number;
}

export function errorMessage(err: unknown): string {
  const e = err as { error?: Partial<ApiError>; message?: string } | null;
  return e?.error?.message ?? e?.message ?? '加载失败，请稍后重试';
}

export function errorRequestId(err: unknown): string | undefined {
  const e = err as { error?: Partial<ApiError> } | null;
  return e?.error?.requestId;
}