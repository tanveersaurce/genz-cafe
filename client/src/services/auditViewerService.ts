import { apiClient } from '@/lib/apiClient';

export interface AuditLogEntry {
  _id: string;
  actorId?: {
    _id: string;
    name: string;
    username: string;
    role: string;
  };
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditQueryParams {
  from?: string;
  to?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export const auditViewerService = {
  async getAuditLogs(params?: AuditQueryParams): Promise<{
    entries: AuditLogEntry[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.actorId) query.set('actorId', params.actorId);
    if (params?.action) query.set('action', params.action);
    if (params?.entityType) query.set('entityType', params.entityType);
    if (params?.entityId) query.set('entityId', params.entityId);
    if (params?.q) query.set('q', params.q);
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<{
      success: boolean;
      data: {
        entries: AuditLogEntry[];
        nextCursor: string | null;
        hasMore: boolean;
      };
    }>(`/audit${qs}`);
    return res.data;
  },

  async getDistinctActions(): Promise<string[]> {
    const res = await apiClient.get<{ success: boolean; data: { actions: string[] } }>(
      '/audit/actions'
    );
    return res.data.actions;
  },

  getExportCsvUrl(params?: AuditQueryParams): string {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.actorId) query.set('actorId', params.actorId);
    if (params?.action) query.set('action', params.action);
    if (params?.entityType) query.set('entityType', params.entityType);
    if (params?.entityId) query.set('entityId', params.entityId);
    if (params?.q) query.set('q', params.q);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    return `${baseUrl}/audit/export.csv${qs}`;
  },
};
