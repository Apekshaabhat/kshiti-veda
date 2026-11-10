import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from './database';

export const notificationRouter = Router();

export interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  message: string;
  category: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  related_id?: string | null;
  source?: string;
  timestamp: number;
  is_read: number;
  is_archived: number;
  action_url?: string | null;
  expires_at?: number | null;
}

// In-memory alert cooldown tracker to prevent notification storms & duplicates
// Map<alertKey, lastTriggeredTimestamp>
const alertCooldownMap = new Map<string, number>();
const COOLDOWN_PERIOD_MS = 15 * 60 * 1000; // 15 minutes cooldown for identical conditions

let wsBroadcastCallback: ((event: string, data: any) => void) | null = null;

export function registerNotificationWs(callback: (event: string, data: any) => void) {
  wsBroadcastCallback = callback;
}

/**
 * Dispatches an automatic notification with deduplication and cooldown checks
 */
export async function triggerNotification(params: {
  userId?: string;
  title: string;
  message: string;
  category: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  relatedId?: string | null;
  source?: string;
  actionUrl?: string | null;
  force?: boolean;
}): Promise<NotificationRecord | null> {
  const userId = params.userId || 'user-1';
  const alertKey = `${userId}:${params.category}:${params.relatedId || 'general'}:${params.severity}`;
  const now = Date.now();

  if (!params.force) {
    const lastTriggered = alertCooldownMap.get(alertKey);
    if (lastTriggered && (now - lastTriggered) < COOLDOWN_PERIOD_MS) {
      // Cooldown active, suppress duplicate notification
      return null;
    }
  }

  alertCooldownMap.set(alertKey, now);

  const notifId = `notif-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const notif: NotificationRecord = {
    id: notifId,
    user_id: userId,
    title: params.title,
    message: params.message,
    category: params.category,
    severity: params.severity,
    related_id: params.relatedId || null,
    source: params.source || 'SYSTEM',
    timestamp: now,
    is_read: 0,
    is_archived: 0,
    action_url: params.actionUrl || null,
    expires_at: null
  };

  try {
    await dbRun(
      `INSERT INTO notifications (id, user_id, title, message, category, severity, related_id, source, timestamp, is_read, is_archived, action_url, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notif.id, notif.user_id, notif.title, notif.message, notif.category, notif.severity,
        notif.related_id, notif.source, notif.timestamp, notif.is_read, notif.is_archived,
        notif.action_url, notif.expires_at
      ]
    );

    // Broadcast in real-time to active WebSocket clients
    if (wsBroadcastCallback) {
      wsBroadcastCallback('NOTIFICATION_NEW', notif);
    }

    return notif;
  } catch (err) {
    console.error('[Notification Engine] Failed to persist notification:', err);
    return null;
  }
}

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

// GET /api/notifications - List notifications with filtering & pagination
notificationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.user_id as string) || 'user-1';
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    const category = req.query.category as string;
    const severity = req.query.severity as string;
    const unreadOnly = req.query.unread === 'true';
    const archivedOnly = req.query.archived === 'true';
    const search = req.query.search as string;

    let sql = `SELECT * FROM notifications WHERE user_id = ?`;
    const params: any[] = [userId];

    if (!archivedOnly) {
      sql += ` AND is_archived = 0`;
    } else {
      sql += ` AND is_archived = 1`;
    }

    if (unreadOnly) {
      sql += ` AND is_read = 0`;
    }

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    if (severity) {
      sql += ` AND severity = ?`;
      params.push(severity.toUpperCase());
    }

    if (search) {
      sql += ` AND (title LIKE ? OR message LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Count query
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const totalRow = await dbGet<{ total: number }>(countSql, params);
    const total = totalRow?.total || 0;

    sql += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const items = await dbAll<NotificationRecord>(sql, params);

    const unreadCountRow = await dbGet<{ unread: number }>(
      `SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0 AND is_archived = 0`,
      [userId]
    );

    res.json({
      notifications: items,
      total,
      unread_count: unreadCountRow?.unread || 0,
      page,
      limit,
      total_pages: Math.ceil(total / limit)
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve notifications: ' + err.message });
  }
});

// GET /api/notifications/unread - Direct unread feed
notificationRouter.get('/unread', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.user_id as string) || 'user-1';
    const items = await dbAll<NotificationRecord>(
      `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 AND is_archived = 0 ORDER BY timestamp DESC LIMIT 50`,
      [userId]
    );
    res.json({ count: items.length, notifications: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/count - Unread count badge
notificationRouter.get('/count', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.user_id as string) || 'user-1';
    const row = await dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0 AND is_archived = 0`,
      [userId]
    );
    res.json({ unread_count: row?.count || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/:id - Single notification
notificationRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await dbGet<NotificationRecord>(`SELECT * FROM notifications WHERE id = ?`, [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Notification not found' });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications - Manual / Admin notification creation
notificationRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, message, category, severity, related_id, source, action_url, user_id } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const notif = await triggerNotification({
      userId: user_id || 'user-1',
      title,
      message,
      category: category || 'SYSTEM',
      severity: severity || 'INFO',
      relatedId: related_id,
      source: source || 'MANUAL',
      actionUrl: action_url,
      force: true
    });

    res.status(201).json(notif);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mark single notification as read (supports both POST and PATCH)
const handleMarkRead = async (req: Request, res: Response) => {
  try {
    const result = await dbRun(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [req.params.id]);
    res.json({ success: true, id: req.params.id, is_read: 1, changes: result.changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
notificationRouter.post('/:id/read', handleMarkRead);
notificationRouter.patch('/:id/read', handleMarkRead);

// Mark single notification as unread (supports both POST and PATCH)
const handleMarkUnread = async (req: Request, res: Response) => {
  try {
    const result = await dbRun(`UPDATE notifications SET is_read = 0 WHERE id = ?`, [req.params.id]);
    res.json({ success: true, id: req.params.id, is_read: 0, changes: result.changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
notificationRouter.post('/:id/unread', handleMarkUnread);
notificationRouter.patch('/:id/unread', handleMarkUnread);

// Mark all notifications as read (supports both /read-all and /mark-all-read with POST and PATCH)
const handleMarkAllRead = async (req: Request, res: Response) => {
  try {
    const userId = req.body?.user_id || (req.query?.user_id as string) || 'user-1';
    const result = await dbRun(
      `UPDATE notifications SET is_read = 1 WHERE (user_id = ? OR user_id = 'default' OR user_id = 'user-default' OR user_id IS NULL) AND is_read = 0`,
      [userId]
    );
    res.json({ success: true, message: 'All notifications marked as read', updated: result.changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
notificationRouter.post('/read-all', handleMarkAllRead);
notificationRouter.patch('/read-all', handleMarkAllRead);
notificationRouter.post('/mark-all-read', handleMarkAllRead);
notificationRouter.patch('/mark-all-read', handleMarkAllRead);

// Archive notification (supports both POST and PATCH)
const handleArchive = async (req: Request, res: Response) => {
  try {
    await dbRun(`UPDATE notifications SET is_archived = 1 WHERE id = ?`, [req.params.id]);
    res.json({ success: true, id: req.params.id, is_archived: 1 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
notificationRouter.post('/:id/archive', handleArchive);
notificationRouter.patch('/:id/archive', handleArchive);

// DELETE /api/notifications/:id - Delete notification
notificationRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await dbRun(`DELETE FROM notifications WHERE id = ?`, [req.params.id]);
    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/preferences - User preferences
notificationRouter.get('/user/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.user_id as string) || 'user-1';
    let pref = await dbGet(`SELECT * FROM notification_preferences WHERE user_id = ?`, [userId]);
    if (!pref) {
      pref = {
        user_id: userId,
        email_enabled: 1,
        push_enabled: 1,
        sms_enabled: 0,
        min_severity: 'INFO',
        categories_json: JSON.stringify(['SOIL_MOISTURE', 'PH_ALERT', 'HARDWARE', 'EXPENSE', 'MARKET'])
      };
    }
    res.json(pref);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/preferences - Update preferences
notificationRouter.put('/user/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || 'user-1';
    const { email_enabled, push_enabled, sms_enabled, min_severity, categories } = req.body;

    await dbRun(
      `INSERT INTO notification_preferences (user_id, email_enabled, push_enabled, sms_enabled, min_severity, categories_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         email_enabled = excluded.email_enabled,
         push_enabled = excluded.push_enabled,
         sms_enabled = excluded.sms_enabled,
         min_severity = excluded.min_severity,
         categories_json = excluded.categories_json`,
      [
        userId,
        email_enabled ? 1 : 0,
        push_enabled ? 1 : 0,
        sms_enabled ? 1 : 0,
        min_severity || 'INFO',
        JSON.stringify(categories || [])
      ]
    );

    res.json({ success: true, message: 'Preferences updated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

