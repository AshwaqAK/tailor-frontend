import type { CursorPage, CursorPageMeta } from '@shared/models/pagination.model';

export enum AuditActorType {
  User = 'USER',
  System = 'SYSTEM',
}

export enum AuditLogAction {
  Created = 'CREATED',
  Updated = 'UPDATED',
  StatusChanged = 'STATUS_CHANGED',
  PaymentRecorded = 'PAYMENT_RECORDED',
  Refunded = 'REFUNDED',
  BillCreated = 'BILL_CREATED',
}

export enum AuditLogEntityType {
  Customer = 'CUSTOMER',
  Order = 'ORDER',
  OrderItem = 'ORDER_ITEM',
  Payment = 'PAYMENT',
  Refund = 'REFUND',
  Alteration = 'ALTERATION',
  AlterationBill = 'ALTERATION_BILL',
  Fabric = 'FABRIC',
}

export type AuditLogMetadata = Record<string, unknown>;

export interface AuditLog {
  readonly _id: string;
  readonly auditId: string;
  readonly actorType: AuditActorType;
  readonly actorId?: string;
  readonly action: AuditLogAction;
  readonly entityType: AuditLogEntityType;
  readonly entityId: string;
  readonly eventAt: string;
  readonly metadata?: AuditLogMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuditLogQuery {
  readonly cursor?: string;
  readonly limit?: number;
  readonly actorId?: string;
  readonly action?: AuditLogAction;
  readonly entityType?: AuditLogEntityType;
  readonly entityId?: string;
  readonly fromDate?: string;
  readonly toDate?: string;
}

export type AuditLogListMeta = CursorPageMeta;

export type AuditLogListResponse = CursorPage<AuditLog>;
