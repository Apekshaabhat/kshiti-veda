import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from './database';
import { triggerNotification } from './notifications';

export const virtualFarmRouter = Router();

// ============================================================================
// REST API ENDPOINTS: FARMS
// ============================================================================

// GET /api/farms - List all farms
virtualFarmRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.user_id as string) || 'user-1';
    const rows = await dbAll(`SELECT * FROM farms WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/farms/:id - Single farm details with zones & active crops
virtualFarmRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const farm = await dbGet(`SELECT * FROM farms WHERE id = ?`, [req.params.id]);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });

    const zones = await dbAll(`SELECT * FROM farm_zones WHERE farm_id = ?`, [req.params.id]);
    const crops = await dbAll(`SELECT * FROM farm_crops WHERE farm_id = ? AND status = 'ACTIVE'`, [req.params.id]);
    const activities = await dbAll(`SELECT * FROM farm_activities WHERE farm_id = ? ORDER BY scheduled_date ASC LIMIT 10`, [req.params.id]);

    res.json({
      ...farm,
      zones,
      crops,
      recent_activities: activities
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/farms - Create farm
virtualFarmRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, lat, lon, area, area_unit, soil_type, irrigation_type, description, user_id } = req.body;
    if (!name || !area) {
      return res.status(400).json({ error: 'Farm name and area are required' });
    }

    const id = req.body.id || `farm-${Date.now()}`;
    const cleanArea = Math.max(0.1, parseFloat(area));

    await dbRun(
      `INSERT INTO farms (id, user_id, name, lat, lon, area, area_unit, soil_type, irrigation_type, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        user_id || 'user-1',
        name,
        lat ? parseFloat(lat) : 18.5204,
        lon ? parseFloat(lon) : 73.8567,
        cleanArea,
        area_unit || 'Acres',
        soil_type || 'Clay Loam',
        irrigation_type || 'Drip Irrigation',
        description || null,
        Date.now()
      ]
    );

    // Auto-create initial default Zone A for the new farm
    const zoneId = `zone-${id}-a`;
    await dbRun(
      `INSERT INTO farm_zones (id, farm_id, name, area, soil_type, irrigation_type, health_score, condition, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 90, 'Optimal', ?)`,
      [zoneId, id, 'Zone A (Main Parcel)', cleanArea, soil_type || 'Clay Loam', irrigation_type || 'Drip Irrigation', Date.now()]
    );

    res.status(201).json({ success: true, id, name, area: cleanArea });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create farm: ' + err.message });
  }
});

// PUT /api/farms/:id - Edit farm
virtualFarmRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, lat, lon, area, area_unit, soil_type, irrigation_type, description } = req.body;
    const existing = await dbGet(`SELECT * FROM farms WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Farm not found' });

    await dbRun(
      `UPDATE farms SET
         name = ?, lat = ?, lon = ?, area = ?, area_unit = ?, soil_type = ?,
         irrigation_type = ?, description = ?
       WHERE id = ?`,
      [
        name || existing.name,
        lat !== undefined ? parseFloat(lat) : existing.lat,
        lon !== undefined ? parseFloat(lon) : existing.lon,
        area !== undefined ? parseFloat(area) : existing.area,
        area_unit || existing.area_unit,
        soil_type || existing.soil_type,
        irrigation_type || existing.irrigation_type,
        description !== undefined ? description : existing.description,
        req.params.id
      ]
    );

    const updated = await dbGet(`SELECT * FROM farms WHERE id = ?`, [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/farms/:id - Delete farm
virtualFarmRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await dbRun(`DELETE FROM farms WHERE id = ?`, [req.params.id]);
    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// REST API ENDPOINTS: ZONES
// ============================================================================

// GET /api/farms/:id/zones - List zones for a farm
virtualFarmRouter.get('/:id/zones', async (req: Request, res: Response) => {
  try {
    const rows = await dbAll(`SELECT * FROM farm_zones WHERE farm_id = ? ORDER BY name ASC`, [req.params.id]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/farms/:id/zones - Create zone in a farm
virtualFarmRouter.post('/:id/zones', async (req: Request, res: Response) => {
  try {
    const { name, area, soil_type, irrigation_type, crop_id, sensor_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Zone name is required' });

    const zoneId = `zone-${Date.now()}`;
    await dbRun(
      `INSERT INTO farm_zones (id, farm_id, name, area, soil_type, irrigation_type, crop_id, sensor_id, health_score, condition, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 92, 'Optimal', ?)`,
      [
        zoneId,
        req.params.id,
        name,
        area ? parseFloat(area) : 2.5,
        soil_type || 'Clay Loam',
        irrigation_type || 'Drip Irrigation',
        crop_id || null,
        sensor_id || null,
        Date.now()
      ]
    );

    res.status(201).json({ id: zoneId, farm_id: req.params.id, name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/farms/:id/zones/:zoneId - Edit zone
virtualFarmRouter.put('/:id/zones/:zoneId', async (req: Request, res: Response) => {
  try {
    const { name, area, soil_type, irrigation_type, crop_id, sensor_id, health_score, condition } = req.body;
    await dbRun(
      `UPDATE farm_zones SET
         name = COALESCE(?, name),
         area = COALESCE(?, area),
         soil_type = COALESCE(?, soil_type),
         irrigation_type = COALESCE(?, irrigation_type),
         crop_id = COALESCE(?, crop_id),
         sensor_id = COALESCE(?, sensor_id),
         health_score = COALESCE(?, health_score),
         condition = COALESCE(?, condition)
       WHERE id = ? AND farm_id = ?`,
      [name, area, soil_type, irrigation_type, crop_id, sensor_id, health_score, condition, req.params.zoneId, req.params.id]
    );
    const updated = await dbGet(`SELECT * FROM farm_zones WHERE id = ?`, [req.params.zoneId]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/farms/:id/zones/:zoneId - Delete zone
virtualFarmRouter.delete('/:id/zones/:zoneId', async (req: Request, res: Response) => {
  try {
    await dbRun(`DELETE FROM farm_zones WHERE id = ? AND farm_id = ?`, [req.params.zoneId, req.params.id]);
    res.json({ success: true, id: req.params.zoneId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// REST API ENDPOINTS: CROPS & CROP CATALOG
// ============================================================================

// GET /api/crops/catalog - Pre-configured crop database
virtualFarmRouter.get('/catalog/crops', async (_req: Request, res: Response) => {
  try {
    const rows = await dbAll(`SELECT * FROM crop_catalog ORDER BY name ASC`);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/farms/:id/crops - Active crops in farm
virtualFarmRouter.get('/:id/crops', async (req: Request, res: Response) => {
  try {
    const rows = await dbAll(`
      SELECT fc.*, z.name as zone_name
      FROM farm_crops fc
      LEFT JOIN farm_zones z ON fc.zone_id = z.id
      WHERE fc.farm_id = ?
      ORDER BY fc.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/farms/:id/crops - Plant / assign crop to farm zone
virtualFarmRouter.post('/:id/crops', async (req: Request, res: Response) => {
  try {
    const { zone_id, crop_name, variety, category, planting_date, expected_harvest_date, area_planted, seed_quantity } = req.body;
    if (!crop_name || !planting_date) {
      return res.status(400).json({ error: 'crop_name and planting_date are required' });
    }

    const id = `fc-${Date.now()}`;
    await dbRun(
      `INSERT INTO farm_crops (id, farm_id, zone_id, crop_name, variety, category, planting_date, expected_harvest_date, growth_stage, area_planted, seed_quantity, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Vegetative', ?, ?, 'ACTIVE', ?)`,
      [
        id,
        req.params.id,
        zone_id || null,
        crop_name,
        variety || 'Standard',
        category || 'Cash Crop',
        planting_date,
        expected_harvest_date || null,
        area_planted ? parseFloat(area_planted) : 1.0,
        seed_quantity ? parseFloat(seed_quantity) : null,
        Date.now()
      ]
    );

    res.status(201).json({ id, farm_id: req.params.id, crop_name, status: 'ACTIVE' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// REST API ENDPOINTS: FARM ACTIVITIES & CALENDAR
// ============================================================================

// GET /api/farms/:id/activities - List activities
virtualFarmRouter.get('/:id/activities', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    let sql = `
      SELECT fa.*, z.name as zone_name, fc.crop_name
      FROM farm_activities fa
      LEFT JOIN farm_zones z ON fa.zone_id = z.id
      LEFT JOIN farm_crops fc ON fa.crop_id = fc.id
      WHERE fa.farm_id = ?
    `;
    const params: any[] = [req.params.id];

    if (status) {
      sql += ` AND fa.status = ?`;
      params.push(status.toUpperCase());
    }

    sql += ` ORDER BY fa.scheduled_date ASC`;
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/farms/:id/activities - Schedule new activity
virtualFarmRouter.post('/:id/activities', async (req: Request, res: Response) => {
  try {
    const { zone_id, crop_id, activity_type, description, scheduled_date, assigned_user, notes } = req.body;
    if (!activity_type || !description || !scheduled_date) {
      return res.status(400).json({ error: 'activity_type, description, and scheduled_date are required' });
    }

    const id = `act-${Date.now()}`;
    await dbRun(
      `INSERT INTO farm_activities (id, farm_id, zone_id, crop_id, activity_type, description, scheduled_date, status, assigned_user, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
      [
        id,
        req.params.id,
        zone_id || null,
        crop_id || null,
        activity_type.toUpperCase(),
        description,
        scheduled_date,
        assigned_user || 'Arjun Kulkarni',
        notes || null,
        Date.now()
      ]
    );

    res.status(201).json({ id, farm_id: req.params.id, description, status: 'PENDING' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/farms/:id/activities/:activityId - Update status (Complete/Pending)
virtualFarmRouter.put('/:id/activities/:activityId', async (req: Request, res: Response) => {
  try {
    const { status, completed_date, notes } = req.body;
    const cleanStatus = status ? status.toUpperCase() : 'COMPLETED';
    const cleanCompletedDate = cleanStatus === 'COMPLETED' ? (completed_date || new Date().toISOString().split('T')[0]) : null;

    await dbRun(
      `UPDATE farm_activities SET
         status = ?, completed_date = ?, notes = COALESCE(?, notes)
       WHERE id = ? AND farm_id = ?`,
      [cleanStatus, cleanCompletedDate, notes, req.params.activityId, req.params.id]
    );

    const updated = await dbGet(`SELECT * FROM farm_activities WHERE id = ?`, [req.params.activityId]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/farms/:id/calendar - Structured calendar events
virtualFarmRouter.get('/:id/calendar', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const activities = await dbAll<any>(`
      SELECT fa.*, z.name as zone_name, fc.crop_name
      FROM farm_activities fa
      LEFT JOIN farm_zones z ON fa.zone_id = z.id
      LEFT JOIN farm_crops fc ON fa.crop_id = fc.id
      WHERE fa.farm_id = ?
      ORDER BY fa.scheduled_date ASC
    `, [req.params.id]);

    const upcoming = activities.filter(a => a.status === 'PENDING' && a.scheduled_date >= today);
    const overdue = activities.filter(a => a.status === 'PENDING' && a.scheduled_date < today);
    const completed = activities.filter(a => a.status === 'COMPLETED');

    // Automatically trigger notification for overdue activities
    if (overdue.length > 0) {
      triggerNotification({
        title: `${overdue.length} Farm Activities Overdue`,
        message: `Task "${overdue[0].description}" scheduled for ${overdue[0].scheduled_date} is overdue.`,
        category: 'FARM_ACTIVITY',
        severity: 'WARNING',
        relatedId: req.params.id,
        source: 'CALENDAR',
        actionUrl: '/virtual-farm'
      });
    }

    res.json({
      farm_id: req.params.id,
      today,
      total_activities: activities.length,
      upcoming_count: upcoming.length,
      overdue_count: overdue.length,
      completed_count: completed.length,
      upcoming,
      overdue,
      completed
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/farms/:id/overview - Executive farm summary KPIs
virtualFarmRouter.get('/:id/overview', async (req: Request, res: Response) => {
  try {
    const farmId = req.params.id;
    const farm = await dbGet(`SELECT * FROM farms WHERE id = ?`, [farmId]);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });

    const zones = await dbAll(`SELECT * FROM farm_zones WHERE farm_id = ?`, [farmId]);
    const crops = await dbAll(`SELECT * FROM farm_crops WHERE farm_id = ? AND status = 'ACTIVE'`, [farmId]);
    const activities = await dbAll(`SELECT * FROM farm_activities WHERE farm_id = ?`, [farmId]);
    const expenses = await dbAll<{ amount: number }>(`SELECT amount FROM expenses WHERE farm_id = ?`, [farmId]);

    const today = new Date().toISOString().split('T')[0];
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const overdueCount = activities.filter(a => a.status === 'PENDING' && a.scheduled_date < today).length;
    const upcomingCount = activities.filter(a => a.status === 'PENDING' && a.scheduled_date >= today).length;

    const cultivatedArea = zones.reduce((s, z) => s + (z.area || 0), 0);
    const avgHealthScore = zones.length
      ? Math.round(zones.reduce((s, z) => s + (z.health_score || 90), 0) / zones.length)
      : 90;

    res.json({
      farm,
      total_zones: zones.length,
      total_area: farm.area,
      cultivated_area: Number(cultivatedArea.toFixed(1)),
      active_crops_count: crops.length,
      active_crops: crops,
      average_health_score: avgHealthScore,
      farm_health_status: avgHealthScore >= 85 ? 'Optimal' : avgHealthScore >= 70 ? 'Moderate' : 'Critical',
      total_expenses: totalExpenses,
      upcoming_activities_count: upcomingCount,
      overdue_activities_count: overdueCount
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

