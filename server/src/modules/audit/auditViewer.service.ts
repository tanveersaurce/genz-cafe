import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Response } from 'express';
import { AuditLog } from './audit.model';
import { auditSettings } from '../../config/auditSettings';

export interface AuditQueryFilters {
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

export function redactMetadata(metadata: unknown): unknown {
  if (!metadata || typeof metadata !== 'object') return metadata;
  if (Array.isArray(metadata)) return metadata.map(redactMetadata);

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('pin') ||
      lowerKey.includes('hash') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('authorization')
    ) {
      continue; // strip
    }

    if (typeof value === 'string') {
      if (lowerKey.includes('phone') || /^\+?[\d\s-]{10,14}$/.test(value)) {
        const digits = value.replace(/\D/g, '');
        if (digits.length >= 4) {
          clean[key] = `******${digits.slice(-4)}`;
          continue;
        }
      }
      clean[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = redactMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let s = typeof val === 'object' ? JSON.stringify(val) : String(val);
  // Formula injection mitigation: prefix cell with single quote if it starts with =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function buildFilter(filters: AuditQueryFilters) {
  const query: Record<string, unknown> = {};

  const nowIst = DateTime.now().setZone('Asia/Kolkata');
  let startDate: Date;
  let endDate: Date;

  if (filters.from) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(filters.from)) {
      startDate = DateTime.fromFormat(filters.from, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' })
        .startOf('day')
        .toJSDate();
    } else {
      startDate = new Date(filters.from);
    }
  } else {
    // Default last 7 days
    startDate = nowIst.minus({ days: 7 }).startOf('day').toJSDate();
  }

  if (filters.to) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
      endDate = DateTime.fromFormat(filters.to, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' })
        .endOf('day')
        .toJSDate();
    } else {
      endDate = new Date(filters.to);
    }
  } else {
    endDate = nowIst.endOf('day').toJSDate();
  }

  query.createdAt = { $gte: startDate, $lte: endDate };

  if (filters.actorId && Types.ObjectId.isValid(filters.actorId)) {
    query.actorId = new Types.ObjectId(filters.actorId);
  }

  if (filters.action) {
    query.action = filters.action;
  }

  if (filters.entityType) {
    query.entityType = filters.entityType;
  }

  if (filters.entityId) {
    query.entityId = filters.entityId;
  }

  if (filters.q && filters.q.trim()) {
    const searchRegex = new RegExp(filters.q.trim(), 'i');
    query.$or = [
      { actorName: searchRegex },
      { action: searchRegex },
      { entityId: searchRegex },
      { ip: searchRegex },
      { userAgent: searchRegex },
    ];
  }

  return { query, startDate, endDate };
}

export const auditViewerService = {
  async getAuditLogs(filters: AuditQueryFilters) {
    const { query } = buildFilter(filters);
    const limit = Math.min(100, Math.max(1, filters.limit || 50));

    if (filters.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(filters.cursor, 'base64').toString('utf8'));
        const cursorDate = new Date(decoded.createdAt);
        const cursorId = new Types.ObjectId(decoded.id);

        query.$and = [
          {
            $or: [
              { createdAt: { $lt: cursorDate } },
              { createdAt: cursorDate, _id: { $lt: cursorId } },
            ],
          },
        ];
      } catch {
        // ignore malformed cursor
      }
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('actorId', 'name username role');

    const hasMore = logs.length > limit;
    const entries = hasMore ? logs.slice(0, limit) : logs;

    let nextCursor: string | null = null;
    if (hasMore && entries.length > 0) {
      const last = entries[entries.length - 1]!;
      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: last.createdAt.toISOString(),
          id: last._id.toString(),
        })
      ).toString('base64');
    }

    const sanitizedEntries = entries.map((doc) => {
      const obj = doc.toObject();
      return {
        ...obj,
        metadata: redactMetadata(obj.metadata),
      };
    });

    return {
      entries: sanitizedEntries,
      nextCursor,
      hasMore,
    };
  },

  async getDistinctActions(): Promise<string[]> {
    const actions = await AuditLog.distinct('action');
    return actions.sort();
  },

  async exportCsv(filters: AuditQueryFilters, res: Response): Promise<void> {
    const { query, startDate, endDate } = buildFilter(filters);
    const startStr = DateTime.fromJSDate(startDate).setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');
    const endStr = DateTime.fromJSDate(endDate).setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-${startStr}-${endStr}.csv"`
    );

    // CSV header row
    res.write('Timestamp (IST),Actor,Action,Entity Type,Entity ID,IP,User Agent,Metadata\r\n');

    const maxExport = auditSettings.exportMaxRows || 5000;
    const cursor = AuditLog.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(maxExport)
      .populate('actorId', 'name username role')
      .cursor();

    for await (const doc of cursor) {
      const istTime = DateTime.fromJSDate(doc.createdAt)
        .setZone('Asia/Kolkata')
        .toFormat('yyyy-MM-dd HH:mm:ss');
      const actorDoc = doc.actorId as unknown as { name?: string; username?: string } | null;
      const actorLabel = actorDoc?.name
        ? `${actorDoc.name} (@${actorDoc.username || ''})`
        : doc.actorName || 'System';
      const meta = redactMetadata(doc.metadata);

      const row =
        [
          sanitizeCsvCell(istTime),
          sanitizeCsvCell(actorLabel),
          sanitizeCsvCell(doc.action),
          sanitizeCsvCell(doc.entityType),
          sanitizeCsvCell(doc.entityId || ''),
          sanitizeCsvCell(doc.ip || ''),
          sanitizeCsvCell(doc.userAgent || ''),
          sanitizeCsvCell(JSON.stringify(meta)),
        ].join(',') + '\r\n';

      res.write(row);
    }

    res.end();
  },
};
