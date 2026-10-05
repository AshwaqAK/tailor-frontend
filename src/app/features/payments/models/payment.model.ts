export enum PaymentMethod {
  Cash = 'CASH',
  Upi = 'UPI',
  Card = 'CARD',
  BankTransfer = 'BANK_TRANSFER',
  Other = 'OTHER',
}

export enum PaymentStatus {
  Pending = 'PENDING',
  Success = 'SUCCESS',
  Failed = 'FAILED',
  Refunded = 'REFUNDED',
}

export interface Payment {
  readonly paymentId: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly status: PaymentStatus;
  readonly transactionId?: string;
  readonly paidAt?: string;
  readonly refundedAt?: string;
  readonly notes?: string;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePaymentRequest {
  readonly orderId: string;
  readonly customerId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly transactionId?: string;
  readonly notes?: string;
}

export type PaymentSortField = 'paidAt' | 'amount' | 'status' | 'createdAt';

export interface PaymentQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly customerId?: string;
  readonly paymentMethod?: PaymentMethod;
  readonly status?: PaymentStatus;
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly sortBy?: PaymentSortField;
  readonly sortOrder?: 'asc' | 'desc';
}

export interface PaginatedPayments {
  readonly data: readonly Payment[];
  readonly meta: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}
