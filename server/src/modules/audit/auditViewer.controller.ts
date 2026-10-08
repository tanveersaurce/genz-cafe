import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { auditViewerService } from './auditViewer.service';

export const auditViewerController = {
  getAuditLogs: asyncHandler(async (req: Request, res: Response) => {
    const { from, to, actorId, action, entityType, entityId, q, cursor, limit } = req.query;

    const result = await auditViewerService.getAuditLogs({
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      actorId: actorId ? String(actorId) : undefined,
      action: action ? String(action) : undefined,
      entityType: entityType ? String(entityType) : undefined,
      entityId: entityId ? String(entityId) : undefined,
      q: q ? String(q) : undefined,
      cursor: cursor ? String(cursor) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  }),

  getDistinctActions: asyncHandler(async (_req: Request, res: Response) => {
    const actions = await auditViewerService.getDistinctActions();

    res.json({
      success: true,
      data: { actions },
    });
  }),

  exportCsv: asyncHandler(async (req: Request, res: Response) => {
    const { from, to, actorId, action, entityType, entityId, q } = req.query;

    await auditViewerService.exportCsv(
      {
        from: from ? String(from) : undefined,
        to: to ? String(to) : undefined,
        actorId: actorId ? String(actorId) : undefined,
        action: action ? String(action) : undefined,
        entityType: entityType ? String(entityType) : undefined,
        entityId: entityId ? String(entityId) : undefined,
        q: q ? String(q) : undefined,
      },
      res
    );
  }),
};
