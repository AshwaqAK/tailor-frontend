import type { AppointmentStatus } from '@features/appointments/models/appointment.model';
import type { QuantityUnit } from '@features/fabrics/models/fabric.model';
import type { OrderStatus } from '@features/orders/models/order.model';

export interface DashboardSummaryQuery {
  /** ISO date (YYYY-MM-DD) or complete ISO date-time accepted by the API. */
  readonly fromDate?: string;
  /** ISO date (YYYY-MM-DD) or complete ISO date-time accepted by the API. */
  readonly toDate?: string;
}

export interface DashboardActivityBreakdown {
  readonly active: number;
  readonly inactive: number;
}

export interface DashboardRecentOrder {
  readonly orderId: string;
  readonly customerId: string;
  readonly customerName?: string;
  readonly totalAmount: number;
  readonly paidAmount: number;
  readonly balanceAmount: number;
  readonly status: OrderStatus;
  readonly createdAt: string;
}

export interface DashboardSummary {
  readonly totalCustomers: number;
  readonly activeCustomers: number;
  readonly totalOrders: number;
  readonly pendingOrders: number;
  readonly inProgressOrders: number;
  readonly completedOrders: number;
  readonly totalAppointments: number;
  readonly upcomingAppointments: number;
  readonly totalActiveFabrics: number;
  readonly totalActiveTailoringServices: number;
  readonly ordersByStatus: Readonly<Record<OrderStatus, number>>;
  readonly appointmentsByStatus: Readonly<Record<AppointmentStatus, number>>;
  readonly customersByActivity: DashboardActivityBreakdown;
  readonly fabricsByActivity: DashboardActivityBreakdown;
  readonly tailoringServicesByActivity: DashboardActivityBreakdown;
  readonly lowStockFabrics: {
    readonly count: number;
    readonly threshold: number;
  };
  readonly ordersToday: number;
  readonly orderValue: number;
  readonly outstanding: {
    readonly total: number;
    readonly orderCount: number;
  };
  readonly recentOrders: readonly DashboardRecentOrder[];
  readonly revenue: {
    readonly collected: number;
  };
  readonly fabricStock: {
    readonly activeFabricCount: number;
    readonly inactiveFabricCount: number;
    readonly availableQuantityByUnit: Readonly<Record<QuantityUnit, number>>;
    readonly lowStock: {
      readonly count: number;
      readonly threshold: number;
    };
  };
  readonly salesMix: {
    readonly tailoringAmount: number;
    readonly attachedFabricAmount: number;
    readonly fabricSaleAmount: number;
    readonly totalOrderValue: number;
  };
}
