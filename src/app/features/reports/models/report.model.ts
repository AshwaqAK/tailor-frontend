import type { OrderStatus } from '@features/orders/models/order.model';
import type {
  AppointmentStatus,
  AppointmentType,
} from '@features/appointments/models/appointment.model';
import type { QuantityUnit } from '@features/fabrics/models/fabric.model';
import type { PaymentMethod, PaymentStatus } from '@features/payments/models/payment.model';

export interface ReportDateQuery {
  readonly fromDate?: string;
  readonly toDate?: string;
}

export interface OrdersReportQuery extends ReportDateQuery {
  readonly customerId?: string;
}

export interface PaymentsReportQuery extends ReportDateQuery {
  readonly customerId?: string;
  readonly paymentMethod?: PaymentMethod;
}

export interface CustomersReportQuery extends ReportDateQuery {
  readonly customerId?: string;
  readonly page?: number;
  readonly limit?: number;
}

export type AppointmentsReportQuery = ReportDateQuery;

export type FabricsReportQuery = ReportDateQuery;

export interface FabricSalesReportQuery extends ReportDateQuery {
  readonly fabricId?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface ServiceUsageReportQuery extends ReportDateQuery {
  readonly serviceId?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface OrdersReport {
  readonly totalOrders: number;
  readonly ordersByStatus: Readonly<Record<OrderStatus, number>>;
  readonly orderTotals: {
    readonly pending: number;
    readonly inProgress: number;
    readonly completed: number;
    readonly cancelled: number;
  };
  readonly orderCount: number;
  readonly orderValue: number;
  readonly paidAmount: number;
  readonly outstandingBalance: number;
  readonly composition: {
    readonly tailoringOnly: number;
    readonly fabricSaleOnly: number;
    readonly mixed: number;
    readonly amounts: {
      readonly tailoringAmount: number;
      readonly attachedFabricAmount: number;
      readonly fabricSaleAmount: number;
    };
  };
}

export interface PaymentsReport {
  readonly grossCollections: number;
  readonly refunds: number;
  readonly netCollections: number;
  readonly paymentCounts: {
    readonly byStatus: Readonly<Record<PaymentStatus, number>>;
    readonly byMethod: Readonly<Record<PaymentMethod, number>>;
  };
}

export interface CustomersReport {
  readonly totalCustomers: number;
  readonly activeCustomers: number;
  readonly inactiveCustomers: number;
  readonly registrationCount: number;
  readonly customerOrderCount: number;
  readonly repeatCustomerCount: number;
  readonly orderValue: number;
  readonly currentPaidAmount: number;
  readonly currentOutstandingBalance: number;
  readonly customerBreakdown: {
    readonly data: readonly CustomerReportRow[];
    readonly meta: ReportPageMeta;
  };
}

export interface AppointmentsReport {
  readonly totalAppointments: number;
  readonly appointmentsByStatus: Readonly<Record<AppointmentStatus, number>>;
  readonly appointmentsByType: Readonly<Record<AppointmentType, number>>;
}

export interface FabricsReport {
  readonly totalFabrics: number;
  readonly activeFabrics: number;
  readonly inactiveFabrics: number;
  readonly lowStockFabrics: {
    readonly count: number;
    readonly threshold: number;
  };
  readonly totalAvailableQuantity: number | null;
  readonly availableQuantityByUnit: Readonly<Record<QuantityUnit, number>>;
}

export interface FabricSalesReport {
  readonly saleCount: number;
  readonly quantitySoldByUnit: Readonly<Record<QuantityUnit, number>>;
  readonly salesAmount: number;
  readonly distinctFabricCount: number;
  readonly fabricBreakdown: {
    readonly data: readonly FabricSalesReportRow[];
    readonly meta: ReportPageMeta;
  };
}

export interface FabricSalesReportRow {
  readonly fabricId: string;
  readonly name: string | null;
  readonly type: string | null;
  readonly color: string | null;
  readonly unit: QuantityUnit | null;
  readonly totalQuantitySold: number;
  readonly totalSalesAmount: number;
  readonly saleLineCount: number;
}

export interface ServiceUsageReport {
  readonly serviceLineCount: number;
  readonly distinctServiceCount: number;
  readonly serviceAmount: number;
  readonly serviceBreakdown: {
    readonly data: readonly ServiceUsageReportRow[];
    readonly meta: ReportPageMeta;
  };
}

export interface ServiceUsageReportRow {
  readonly serviceId: string;
  readonly name: string | null;
  readonly totalQuantity: number;
  readonly lineCount: number;
  readonly serviceAmount: number;
}

export interface CustomerReportRow {
  readonly customerId: string;
  readonly customerName: string | null;
  readonly orderCount: number;
  readonly orderValue: number;
  readonly currentPaidAmount: number;
  readonly currentOutstandingBalance: number;
  readonly latestOrderCreatedAt: string | null;
}

export interface ReportPageMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}
