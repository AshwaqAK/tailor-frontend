import type { ClothingType, FitPreference } from '@features/customers/models/measurement.model';

export enum OrderStatus {
  Draft = 'DRAFT',
  Confirmed = 'CONFIRMED',
  InProgress = 'IN_PROGRESS',
  Ready = 'READY',
  Delivered = 'DELIVERED',
  Cancelled = 'CANCELLED',
}
export enum OrderPaymentStatus {
  Unpaid = 'UNPAID',
  PartiallyPaid = 'PARTIALLY_PAID',
  Paid = 'PAID',
}

export interface MeasurementSnapshot {
  readonly customerId: string;
  readonly measurementId: string;
  readonly measurementVersion: number;
  readonly clothingType: ClothingType;
  readonly measurements: Readonly<Record<string, number>>;
  readonly fitPreference?: FitPreference;
  readonly notes?: string;
  readonly measuredAt: string;
}
export interface FabricSnapshot {
  readonly fabricId: string;
  readonly name: string;
  readonly type: string;
  readonly color: string;
  readonly unit: string;
  readonly pricePerUnit: number;
  readonly quantityUsed: number;
}
export interface ServiceSnapshot {
  readonly serviceId: string;
  readonly name: string;
  readonly price: number;
  readonly quantity: number;
  readonly lineAmount: number;
}
export interface OrderItem {
  readonly _id: string;
  readonly orderId: string;
  readonly clothingType: ClothingType;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly measurementVersion?: number;
  readonly measurementSnapshot?: MeasurementSnapshot;
  readonly fabricSnapshot?: FabricSnapshot;
  readonly serviceSnapshot?: ServiceSnapshot;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface Order {
  readonly _id: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly orderDate: string;
  readonly expectedDeliveryDate?: string;
  readonly status: OrderStatus;
  readonly totalAmount: number;
  readonly paidAmount: number;
  readonly balanceAmount: number;
  readonly notes?: string;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface OrderWithItems {
  readonly order: Order;
  readonly items: readonly OrderItem[];
  readonly paymentStatus: OrderPaymentStatus;
}
export interface CursorPaginatedOrders {
  readonly data: readonly OrderWithItems[];
  readonly meta: {
    readonly limit: number;
    readonly hasNextPage: boolean;
    readonly nextCursor: string | null;
  };
}
export interface CreateOrderItemRequest {
  readonly clothingType: ClothingType;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly measurementId: string;
  readonly serviceId?: string;
  readonly fabricId?: string;
  readonly fabricQuantity?: number;
  readonly notes?: string;
}
export interface CreateOrderRequest {
  readonly customerId: string;
  readonly orderDate: string;
  readonly expectedDeliveryDate?: string;
  readonly notes?: string;
  readonly items: readonly CreateOrderItemRequest[];
}

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.Draft]: [OrderStatus.Confirmed, OrderStatus.Cancelled],
  [OrderStatus.Confirmed]: [OrderStatus.InProgress, OrderStatus.Cancelled],
  [OrderStatus.InProgress]: [OrderStatus.Ready, OrderStatus.Cancelled],
  [OrderStatus.Ready]: [OrderStatus.Delivered],
  [OrderStatus.Delivered]: [],
  [OrderStatus.Cancelled]: [],
};
