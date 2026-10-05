export enum AppointmentType {
  Consultation = 'CONSULTATION',
  Measurement = 'MEASUREMENT',
  Fitting = 'FITTING',
  Trial = 'TRIAL',
  Pickup = 'PICKUP',
}

export enum AppointmentStatus {
  Scheduled = 'SCHEDULED',
  Confirmed = 'CONFIRMED',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
  NoShow = 'NO_SHOW',
}

export interface Appointment {
  readonly _id: string;
  readonly appointmentId: string;
  readonly customerId: string;
  readonly orderId?: string;
  readonly appointmentDate: string;
  readonly appointmentTime: string;
  readonly type: AppointmentType;
  readonly status: AppointmentStatus;
  readonly notes?: string;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAppointmentRequest {
  readonly customerId: string;
  readonly orderId?: string;
  readonly appointmentDate: string;
  readonly appointmentTime: string;
  readonly type: AppointmentType;
  readonly notes?: string;
}

export interface UpdateAppointmentRequest {
  readonly customerId?: string;
  readonly orderId?: string;
  readonly appointmentDate?: string;
  readonly appointmentTime?: string;
  readonly type?: AppointmentType;
  readonly status?: AppointmentStatus;
  readonly notes?: string;
}

export type AppointmentSortField = 'appointmentDate' | 'appointmentTime' | 'status' | 'createdAt';

export interface AppointmentQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly customerId?: string;
  readonly orderId?: string;
  readonly appointmentDate?: string;
  readonly type?: AppointmentType;
  readonly status?: AppointmentStatus;
  readonly sortBy?: AppointmentSortField;
  readonly sortOrder?: 'asc' | 'desc';
}

export interface PaginatedAppointments {
  readonly data: readonly Appointment[];
  readonly meta: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}
