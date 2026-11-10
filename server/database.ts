import sqlite3 from 'sqlite3';
import path from 'path';

// Database setup: file-backed dev.db or env specified path
const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'server', 'dev.db');
export const db = new sqlite3.Database(DB_PATH);

// Helper for promise-based queries
export function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export function dbRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export async function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Enable WAL mode & foreign keys for performance and referential integrity
      db.run(`PRAGMA journal_mode = WAL;`);
      db.run(`PRAGMA foreign_keys = ON;`);

      // Safe column migrations for existing databases
      db.run(`ALTER TABLE farms ADD COLUMN location TEXT DEFAULT 'Kolar, Karnataka'`, () => {});
      db.run(`ALTER TABLE farms ADD COLUMN area_unit TEXT DEFAULT 'acre'`, () => {});
      db.run(`ALTER TABLE farms ADD COLUMN data_source TEXT DEFAULT 'DEMO_SEED'`, () => {});
      db.run(`ALTER TABLE market_prices ADD COLUMN commodity_name TEXT`, () => {});
      db.run(`ALTER TABLE market_prices ADD COLUMN variety TEXT`, () => {});
      db.run(`ALTER TABLE market_prices ADD COLUMN market_name TEXT`, () => {});
      db.run(`ALTER TABLE market_prices ADD COLUMN district TEXT`, () => {});
      db.run(`ALTER TABLE market_prices ADD COLUMN state TEXT`, () => {});
      db.run(`ALTER TABLE market_prices ADD COLUMN source TEXT DEFAULT 'DEMO_SEED'`, () => {});
      db.run(`ALTER TABLE market_prices ADD COLUMN source_record_id TEXT`, () => {});
      db.run(`ALTER TABLE market_prices ADD COLUMN fetched_at INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE market_prices ADD COLUMN data_status TEXT DEFAULT 'DEMO'`, () => {});

      // ======================================================================
      // 1. CORE FARMS & ZONES TABLES
      // ======================================================================
      db.run(`CREATE TABLE IF NOT EXISTS farms (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'user-1',
        name TEXT NOT NULL,
        location TEXT DEFAULT 'Kolar, Karnataka',
        lat REAL,
        lon REAL,
        area REAL NOT NULL DEFAULT 5.0,
        area_unit TEXT DEFAULT 'acre',
        soil_type TEXT DEFAULT 'Red loamy soil',
        irrigation_type TEXT DEFAULT 'Drip irrigation',
        description TEXT,
        data_source TEXT DEFAULT 'DEMO_SEED',
        created_at INTEGER NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS farm_zones (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL,
        name TEXT NOT NULL,
        area REAL DEFAULT 3.5,
        soil_type TEXT DEFAULT 'Clay Loam',
        irrigation_type TEXT DEFAULT 'Drip Irrigation',
        crop_id TEXT,
        sensor_id TEXT,
        health_score INTEGER DEFAULT 90,
        condition TEXT DEFAULT 'Optimal',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
      )`);

      // ======================================================================
      // 2. CROP CATALOG & FARM CROPS
      // ======================================================================
      db.run(`CREATE TABLE IF NOT EXISTS crop_catalog (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        variety TEXT,
        category TEXT DEFAULT 'Cereal',
        optimal_ph_min REAL DEFAULT 6.0,
        optimal_ph_max REAL DEFAULT 7.5,
        optimal_n_min REAL DEFAULT 60.0,
        optimal_n_max REAL DEFAULT 120.0,
        optimal_p_min REAL DEFAULT 30.0,
        optimal_p_max REAL DEFAULT 60.0,
        optimal_k_min REAL DEFAULT 40.0,
        optimal_k_max REAL DEFAULT 80.0,
        optimal_temp_min REAL DEFAULT 18.0,
        optimal_temp_max REAL DEFAULT 32.0,
        water_factor REAL DEFAULT 1.0,
        maturity_days INTEGER DEFAULT 120
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS farm_crops (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL,
        zone_id TEXT,
        crop_name TEXT NOT NULL,
        variety TEXT,
        category TEXT DEFAULT 'Cash Crop',
        planting_date TEXT NOT NULL,
        expected_harvest_date TEXT,
        actual_harvest_date TEXT,
        growth_stage TEXT DEFAULT 'Vegetative',
        area_planted REAL,
        seed_quantity REAL,
        harvest_quantity REAL,
        status TEXT DEFAULT 'ACTIVE',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
      )`);

      // ======================================================================
      // 3. FARM ACTIVITIES & CALENDAR
      // ======================================================================
      db.run(`CREATE TABLE IF NOT EXISTS farm_activities (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL,
        zone_id TEXT,
        crop_id TEXT,
        activity_type TEXT NOT NULL,
        description TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        completed_date TEXT,
        status TEXT DEFAULT 'PENDING',
        assigned_user TEXT DEFAULT 'Arjun Kulkarni',
        expense_id TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
      )`);

      // ======================================================================
      // 4. EXPENSES & BUDGET MANAGEMENT
      // ======================================================================
      db.run(`CREATE TABLE IF NOT EXISTS expense_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        icon TEXT DEFAULT 'Receipt',
        is_default INTEGER DEFAULT 1
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'user-1',
        farm_id TEXT NOT NULL,
        zone_id TEXT,
        category TEXT NOT NULL,
        description TEXT,
        amount REAL NOT NULL CHECK(amount >= 0),
        currency TEXT DEFAULT 'INR',
        quantity REAL,
        unit TEXT,
        purchase_date TEXT NOT NULL,
        vendor TEXT,
        payment_method TEXT DEFAULT 'UPI',
        payment_status TEXT DEFAULT 'PAID',
        due_date TEXT,
        invoice_number TEXT,
        receipt_attachment TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS farm_budgets (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'user-1',
        farm_id TEXT NOT NULL,
        category TEXT NOT NULL,
        monthly_budget REAL NOT NULL,
        annual_budget REAL NOT NULL,
        alert_threshold_percent REAL DEFAULT 85.0,
        FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
      )`);

      // ======================================================================
      // 5. AGRICULTURAL MARKET PRICES
      // ======================================================================
      db.run(`CREATE TABLE IF NOT EXISTS commodities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        variety TEXT,
        unit TEXT DEFAULT '₹/quintal'
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS markets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mandi_name TEXT NOT NULL,
        state TEXT NOT NULL,
        district TEXT NOT NULL,
        lat REAL,
        lon REAL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS market_prices (
        id TEXT PRIMARY KEY,
        commodity_id TEXT NOT NULL,
        commodity_name TEXT,
        variety TEXT,
        market_id TEXT NOT NULL,
        market_name TEXT,
        district TEXT,
        state TEXT,
        arrival_date TEXT NOT NULL,
        min_price REAL NOT NULL,
        max_price REAL NOT NULL,
        modal_price REAL NOT NULL,
        unit TEXT DEFAULT 'quintal',
        currency TEXT DEFAULT 'INR',
        source TEXT DEFAULT 'DEMO_SEED',
        source_record_id TEXT,
        fetched_at INTEGER NOT NULL,
        data_status TEXT DEFAULT 'DEMO',
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (commodity_id) REFERENCES commodities(id),
        FOREIGN KEY (market_id) REFERENCES markets(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS commodity_watchlists (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'user-1',
        commodity_id TEXT NOT NULL,
        market_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (commodity_id) REFERENCES commodities(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS market_price_alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'user-1',
        commodity_id TEXT NOT NULL,
        market_id TEXT,
        target_price REAL NOT NULL,
        condition TEXT NOT NULL CHECK(condition IN ('ABOVE', 'BELOW')),
        is_active INTEGER DEFAULT 1,
        last_triggered INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (commodity_id) REFERENCES commodities(id)
      )`);

      // ======================================================================
      // 6. NOTIFICATION SYSTEM
      // ======================================================================
      db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'user-1',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL')),
        related_id TEXT,
        source TEXT DEFAULT 'SYSTEM',
        timestamp INTEGER NOT NULL,
        is_read INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        action_url TEXT,
        expires_at INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id TEXT PRIMARY KEY,
        email_enabled INTEGER DEFAULT 1,
        push_enabled INTEGER DEFAULT 1,
        sms_enabled INTEGER DEFAULT 0,
        min_severity TEXT DEFAULT 'INFO',
        categories_json TEXT DEFAULT '[]'
      )`);

      // ======================================================================
      // 7. AGRICULTURAL REPORTS & EXPORTS
      // ======================================================================
      db.run(`CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        user_id TEXT DEFAULT 'user-1',
        farm_id TEXT NOT NULL,
        report_title TEXT NOT NULL,
        report_type TEXT NOT NULL,
        date_from TEXT NOT NULL,
        date_to TEXT NOT NULL,
        generated_at INTEGER NOT NULL,
        summary_text TEXT NOT NULL,
        sensor_stats_json TEXT NOT NULL,
        soil_health_json TEXT,
        zone_data_json TEXT,
        ai_insights_json TEXT,
        alerts_json TEXT,
        expenses_json TEXT,
        market_json TEXT,
        activities_json TEXT,
        recommendations_json TEXT,
        provenance_json TEXT NOT NULL
      )`);

      // ======================================================================
      // 8. TELEMETRY, DEVICES & ALERTS (Existing preserved)
      // ======================================================================
      db.run(`CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone TEXT,
        moisture REAL,
        ph REAL,
        nitrogen REAL,
        phosphorus REAL,
        potassium REAL,
        temperature REAL,
        timestamp INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS hardware_devices (
        device_id TEXT PRIMARY KEY,
        name TEXT,
        status TEXT,
        last_seen INTEGER,
        wifi_rssi INTEGER,
        first_registered INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS hardware_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        soil_moisture REAL,
        soil_raw_adc INTEGER,
        soil_ph REAL,
        ph_status TEXT DEFAULT 'VALID',
        air_temperature REAL,
        air_humidity REAL,
        soil_temperature REAL,
        light_intensity REAL,
        light_source TEXT DEFAULT 'PH_MODULE_L_RAW',
        light_unit TEXT DEFAULT 'raw',
        wifi_rssi INTEGER,
        uptime_ms INTEGER,
        timestamp INTEGER,
        received_at TEXT
      )`);
      db.run(`ALTER TABLE hardware_readings ADD COLUMN ph_status TEXT DEFAULT 'VALID'`, () => {});
      db.run(`ALTER TABLE hardware_readings ADD COLUMN light_source TEXT DEFAULT 'PH_MODULE_L_RAW'`, () => {});
      db.run(`ALTER TABLE hardware_readings ADD COLUMN light_unit TEXT DEFAULT 'raw'`, () => {});

      db.run(`CREATE TABLE IF NOT EXISTS hardware_ai_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        overall_score INTEGER,
        soil_status TEXT,
        water_requirement TEXT,
        fungal_disease_risk TEXT,
        photosynthesis_efficiency TEXT,
        insights_json TEXT,
        prescriptions_json TEXT,
        timestamp INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS hardware_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        parameter TEXT,
        severity TEXT,
        message TEXT,
        recommendation TEXT,
        resolved INTEGER DEFAULT 0,
        timestamp INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS telemetry_mode (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        mode TEXT NOT NULL DEFAULT 'LIVE',
        updated_at INTEGER NOT NULL
      )`);
      db.run(`INSERT OR IGNORE INTO telemetry_mode (id, mode, updated_at) VALUES (1, 'LIVE', ?)`, [Date.now()]);

      db.run(`CREATE TABLE IF NOT EXISTS simulation_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moisture REAL,
        ph REAL,
        soil_temperature REAL,
        air_temperature REAL,
        air_humidity REAL,
        light_intensity REAL,
        nitrogen REAL,
        phosphorus REAL,
        potassium REAL,
        timestamp INTEGER
      )`);

      // ======================================================================
      // 9. INDEXES FOR PERFORMANCE
      // ======================================================================
      db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, is_archived);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp DESC);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_farm_date ON expenses(farm_id, purchase_date DESC);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_market_prices_lookup ON market_prices(commodity_id, market_id, arrival_date DESC);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_activities_farm_status ON farm_activities(farm_id, status, scheduled_date);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_hardware_readings_time ON hardware_readings(timestamp DESC);`);

      // Seed initial data if tables are empty
      seedInitialData(resolve, reject);
    });
  });
}

function seedInitialData(resolve: () => void, reject: (err: any) => void) {
  const nowTs = Date.now();
  const today = new Date().toISOString().split('T')[0];

  // 1. Seed Default Farms (Sample matching Part 7)
  db.run(`INSERT OR IGNORE INTO farms (id, user_id, name, location, lat, lon, area, area_unit, soil_type, irrigation_type, description, data_source, created_at)
    VALUES ('farm-1', 'user-1', 'Green Valley Estate', 'Kolar, Karnataka', 13.1367, 78.1291, 5.0, 'acre', 'Red loamy soil', 'Drip irrigation', 'High-precision automated agricultural digital twin parcel', 'DEMO_SEED', ?)`,
    [nowTs]);

  db.run(`INSERT OR IGNORE INTO farms (id, user_id, name, location, lat, lon, area, area_unit, soil_type, irrigation_type, description, data_source, created_at)
    VALUES ('farm-2', 'user-1', 'North Field Farm', 'Bengaluru Rural, Karnataka', 13.2385, 77.5620, 8.5, 'acre', 'Sandy Loam', 'Micro-Sprinkler', 'Horticulture and vegetable cultivation block', 'DEMO_SEED', ?)`,
    [nowTs]);

  // 2. Seed Default Zones (Part 7 exact zones)
  db.run(`INSERT OR IGNORE INTO farm_zones (id, farm_id, name, area, soil_type, irrigation_type, crop_id, sensor_id, health_score, condition, created_at)
    VALUES ('zone-a', 'farm-1', 'Zone A', 1.5, 'Red loamy soil', 'Drip irrigation', 'crop-tomato', 'ESP32-01', 94, 'Optimal', ?)`,
    [nowTs]);

  db.run(`INSERT OR IGNORE INTO farm_zones (id, farm_id, name, area, soil_type, irrigation_type, crop_id, sensor_id, health_score, condition, created_at)
    VALUES ('zone-b', 'farm-1', 'Zone B - South Orchard', 2.0, 'Red soil', 'Drip irrigation', 'crop-ragi', NULL, 88, 'Healthy', ?)`,
    [nowTs]);

  db.run(`INSERT OR IGNORE INTO farm_zones (id, farm_id, name, area, soil_type, irrigation_type, crop_id, sensor_id, health_score, condition, created_at)
    VALUES ('zone-c', 'farm-1', 'Zone C - East Greenhouse', 1.5, 'Loamy soil', 'Mist/Micro-Spray', 'crop-capsicum', NULL, 86, 'Healthy', ?)`,
    [nowTs]);

  // 3. Seed Crop Catalog (13+ supported crops)
  const crops = [
    ['crop-basmati', 'Basmati Rice', 'Pusa 1121', 'Cereal', 5.5, 6.8, 80, 120, 40, 60, 60, 90, 22, 34, 1.8, 135],
    ['crop-rice', 'Non-Basmati Rice', 'Sona Masuri', 'Cereal', 5.5, 7.0, 75, 110, 35, 55, 50, 80, 20, 32, 1.6, 125],
    ['crop-wheat', 'Wheat', 'Sharbati', 'Cereal', 6.0, 7.5, 90, 130, 35, 55, 45, 70, 16, 28, 0.9, 120],
    ['crop-maize', 'Maize', 'Yellow Hybrid', 'Cereal', 5.8, 7.2, 80, 120, 40, 60, 50, 80, 20, 32, 1.1, 105],
    ['crop-ragi', 'Ragi', 'Indaf 9', 'Millet', 5.5, 7.5, 50, 80, 25, 45, 40, 65, 18, 30, 0.7, 115],
    ['crop-tomato', 'Tomato', 'Abhinav Hybrid', 'Vegetable', 6.0, 6.8, 70, 100, 45, 65, 60, 90, 20, 30, 1.3, 90],
    ['crop-onion', 'Onion', 'Nashik Red', 'Vegetable', 6.0, 7.0, 60, 90, 35, 50, 50, 75, 18, 28, 1.1, 110],
    ['crop-potato', 'Potato', 'Kufri Jyoti', 'Tuber', 5.2, 6.5, 80, 110, 40, 60, 70, 100, 15, 24, 1.2, 100],
    ['crop-cotton', 'Cotton', 'DCH-32 Hybrid', 'Fiber', 6.0, 8.0, 80, 120, 30, 50, 40, 70, 22, 36, 1.1, 160],
    ['crop-soybean', 'Soybean', 'JS 335', 'Oilseed', 6.0, 7.5, 40, 70, 40, 65, 40, 70, 20, 32, 1.0, 100],
    ['crop-groundnut', 'Groundnut', 'TMV-2', 'Oilseed', 5.8, 6.8, 40, 65, 35, 55, 40, 60, 22, 32, 0.8, 110],
    ['crop-turmeric', 'Turmeric', 'Salem Raw', 'Spice', 5.5, 7.0, 80, 120, 40, 60, 70, 110, 20, 34, 1.4, 240],
    ['crop-chilli', 'Chilli', 'Byadagi Red', 'Spice', 6.0, 7.2, 70, 100, 40, 60, 50, 80, 20, 32, 1.2, 120],
    ['crop-capsicum', 'Capsicum', 'Indra Hybrid', 'Vegetable', 6.0, 6.8, 75, 105, 45, 65, 65, 95, 18, 28, 1.2, 95]
  ];

  crops.forEach(c => {
    db.run(`INSERT OR IGNORE INTO crop_catalog (id, name, variety, category, optimal_ph_min, optimal_ph_max, optimal_n_min, optimal_n_max, optimal_p_min, optimal_p_max, optimal_k_min, optimal_k_max, optimal_temp_min, optimal_temp_max, water_factor, maturity_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, c);
  });

  // 4. Seed Active Farm Crops (Part 7)
  db.run(`INSERT OR IGNORE INTO farm_crops (id, farm_id, zone_id, crop_name, variety, category, planting_date, expected_harvest_date, growth_stage, area_planted, seed_quantity, status, created_at)
    VALUES ('fc-1', 'farm-1', 'zone-a', 'Tomato', 'Abhinav Hybrid', 'Vegetable', '2026-10-01', '2026-12-30', 'Flowering & Fruit Set', 1.5, 6, 'ACTIVE', ?)`,
    [nowTs - 86400000 * 30]);

  db.run(`INSERT OR IGNORE INTO farm_crops (id, farm_id, zone_id, crop_name, variety, category, planting_date, expected_harvest_date, growth_stage, area_planted, seed_quantity, status, created_at)
    VALUES ('fc-2', 'farm-1', 'zone-b', 'Ragi', 'Indaf 9', 'Millet', '2026-09-15', '2026-12-15', 'Grain Filling', 2.0, 18, 'ACTIVE', ?)`,
    [nowTs - 86400000 * 45]);

  db.run(`INSERT OR IGNORE INTO farm_crops (id, farm_id, zone_id, crop_name, variety, category, planting_date, expected_harvest_date, growth_stage, area_planted, seed_quantity, status, created_at)
    VALUES ('fc-3', 'farm-1', 'zone-c', 'Capsicum', 'Indra Hybrid', 'Vegetable', '2026-10-10', '2027-01-10', 'Vegetative Growth', 1.5, 4, 'ACTIVE', ?)`,
    [nowTs - 86400000 * 20]);

  // 5. Seed Farm Activities (Part 7 scheduled activities)
  const daysOffset = (d: number) => new Date(nowTs + d * 86400000).toISOString().split('T')[0];

  const activities = [
    ['act-1', 'farm-1', 'zone-a', 'fc-1', 'IRRIGATION', 'Precision drip irrigation cycle for Zone A Tomato', daysOffset(0), null, 'PENDING', 'Arjun Kulkarni', 'Triggered based on capacitive soil moisture below 55%'],
    ['act-2', 'farm-1', 'zone-a', 'fc-1', 'FERTILIZATION', 'Organic fertilizer foliar booster application', daysOffset(1), null, 'PENDING', 'Suresh Patil', 'Enhances fruit set and micronutrient uptake'],
    ['act-3', 'farm-1', 'zone-a', 'fc-1', 'INSPECTION', 'Weekly crop pest and root health inspection', daysOffset(3), null, 'PENDING', 'Arjun Kulkarni', 'Monitor for early blight and whitefly vectors'],
    ['act-4', 'farm-1', 'zone-b', 'fc-2', 'WEEDING', 'Inter-row mechanical weeding for Zone B Ragi', daysOffset(5), null, 'PENDING', 'Farm Crew', 'Soil aeration and competing weed suppression'],
    ['act-5', 'farm-1', 'zone-a', 'fc-1', 'HARVEST_PREP', 'Harvest crate sterilization and packing staging', daysOffset(10), null, 'PENDING', 'Arjun Kulkarni', 'Sanitizing food-grade plastic sorting crates'],
    ['act-6', 'farm-1', 'zone-a', 'fc-1', 'SOIL_PREP', 'Pre-sowing compost incorporation and deep tilling', daysOffset(-14), daysOffset(-14), 'COMPLETED', 'Arjun Kulkarni', 'Incorporated 4 tonnes/acre organic vermicompost']
  ];

  activities.forEach(a => {
    db.run(`INSERT OR IGNORE INTO farm_activities (id, farm_id, zone_id, crop_id, activity_type, description, scheduled_date, completed_date, status, assigned_user, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [...a, nowTs]);
  });

  // 6. Seed Complete Expense Categories (Part 5)
  const categories = [
    ['cat-seeds', 'Seeds', 'Sprout'],
    ['cat-fertilizers', 'Fertilizers', 'FlaskConical'],
    ['cat-pesticides', 'Pesticides', 'ShieldAlert'],
    ['cat-labour', 'Labour', 'Users'],
    ['cat-irrigation', 'Irrigation', 'Droplets'],
    ['cat-electricity', 'Electricity', 'Zap'],
    ['cat-water', 'Water', 'Waves'],
    ['cat-machinery', 'Machinery', 'Tractor'],
    ['cat-equipment', 'Equipment', 'Wrench'],
    ['cat-fuel', 'Fuel', 'Fuel'],
    ['cat-transport', 'Transportation', 'Truck'],
    ['cat-harvesting', 'Harvesting', 'Scissors'],
    ['cat-packaging', 'Packaging', 'Box'],
    ['cat-maintenance', 'Maintenance', 'Settings'],
    ['cat-other', 'Other', 'Receipt']
  ];

  categories.forEach(cat => {
    db.run(`INSERT OR IGNORE INTO expense_categories (id, name, icon) VALUES (?, ?, ?)`, cat);
  });

  // 7. Seed Sample Expenses (Part 7 exact records)
  const sampleExpenses = [
    ['exp-1', 'user-1', 'farm-1', 'zone-a', 'Seeds', 'Tomato seed purchase', 2500.0, 'INR', 6, 'packets', '2026-11-01', 'Kolar Krishi Seva Kendra', 'UPI', 'PAID', 'High germination hybrid seeds', nowTs, nowTs],
    ['exp-2', 'user-1', 'farm-1', 'zone-a', 'Fertilizers', 'Organic fertilizer', 4200.0, 'INR', 12, 'bags', '2026-11-02', 'IFFCO Agro Centre', 'Bank Transfer', 'PAID', 'Enriched vermicompost & neem cake', nowTs, nowTs],
    ['exp-3', 'user-1', 'farm-1', 'zone-a', 'Labour', 'Field preparation', 3000.0, 'INR', 8, 'person-days', '2026-11-03', 'Local Crew (Kolar)', 'Cash', 'PENDING', 'Land leveling & bed preparation', nowTs, nowTs],
    ['exp-4', 'user-1', 'farm-1', 'zone-a', 'Irrigation', 'Drip irrigation maintenance', 1500.0, 'INR', 1, 'service', '2026-11-04', 'Jain Drip Spares', 'UPI', 'PAID', 'Emitter cleanout and valve replacement', nowTs, nowTs],
    ['exp-5', 'user-1', 'farm-1', 'zone-a', 'Pesticides', 'Crop protection supplies', 1800.0, 'INR', 2, 'litres', '2026-11-05', 'BioShield Organics', 'UPI', 'PENDING', 'Neem oil biopesticide formulation', nowTs, nowTs]
  ];

  sampleExpenses.forEach(e => {
    db.run(`INSERT OR IGNORE INTO expenses (id, user_id, farm_id, zone_id, category, description, amount, currency, quantity, unit, purchase_date, vendor, payment_method, payment_status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, e);
  });

  // 8. Seed Default Budgets
  db.run(`INSERT OR IGNORE INTO farm_budgets (id, user_id, farm_id, category, monthly_budget, annual_budget, alert_threshold_percent)
    VALUES ('bgt-1', 'user-1', 'farm-1', 'Total', 35000.0, 400000.0, 80.0)`);
  db.run(`INSERT OR IGNORE INTO farm_budgets (id, user_id, farm_id, category, monthly_budget, annual_budget, alert_threshold_percent)
    VALUES ('bgt-2', 'user-1', 'farm-1', 'Fertilizers', 10000.0, 120000.0, 80.0)`);
  db.run(`INSERT OR IGNORE INTO farm_budgets (id, user_id, farm_id, category, monthly_budget, annual_budget, alert_threshold_percent)
    VALUES ('bgt-3', 'user-1', 'farm-1', 'Labour', 12000.0, 140000.0, 80.0)`);

  // 9. Seed 10 Karnataka APMC Markets (Part 2)
  const karnatakaMarkets = [
    ['mandi-bengaluru', 'Bengaluru APMC', 'Yeshwanthpur Main Yard', 'Karnataka', 'Bengaluru Urban', 13.028, 77.540],
    ['mandi-kolar', 'Kolar APMC', 'Kolar APMC Market Yard', 'Karnataka', 'Kolar', 13.136, 78.129],
    ['mandi-mysuru', 'Mysuru APMC', 'Bandipalya Market Yard', 'Karnataka', 'Mysuru', 12.285, 76.665],
    ['mandi-hubballi', 'Hubballi APMC', 'Amargol Market Yard', 'Karnataka', 'Dharwad', 15.385, 75.110],
    ['mandi-davanagere', 'Davanagere APMC', 'Grain & Cotton Yard', 'Karnataka', 'Davanagere', 14.464, 75.921],
    ['mandi-belagavi', 'Belagavi APMC', 'APMC Market Yard', 'Karnataka', 'Belagavi', 15.849, 74.497],
    ['mandi-shivamogga', 'Shivamogga APMC', 'Shivamogga Grain Market', 'Karnataka', 'Shivamogga', 13.929, 75.568],
    ['mandi-hassan', 'Hassan APMC', 'Hassan APMC Sub-Yard', 'Karnataka', 'Hassan', 13.007, 76.103],
    ['mandi-raichur', 'Raichur APMC', 'Raichur Cotton & Grain Yard', 'Karnataka', 'Raichur', 16.207, 77.355],
    ['mandi-kalaburagi', 'Kalaburagi APMC', 'Nehru Gunj Market Yard', 'Karnataka', 'Kalaburagi', 17.329, 76.834]
  ];

  karnatakaMarkets.forEach(m => {
    db.run(`INSERT OR IGNORE INTO markets (id, name, mandi_name, state, district, lat, lon) VALUES (?, ?, ?, ?, ?, ?, ?)`, m);
  });

  // Seed 13 Commodities (Part 2)
  const commodityList = [
    ['comm-basmati-rice', 'Basmati Rice', 'Cereals', 'Pusa 1121', '₹/quintal'],
    ['comm-rice', 'Non-Basmati Rice', 'Cereals', 'Sona Masuri', '₹/quintal'],
    ['comm-wheat', 'Wheat', 'Cereals', 'Sharbati/Lokwan', '₹/quintal'],
    ['comm-maize', 'Maize', 'Cereals', 'Yellow Hybrid', '₹/quintal'],
    ['comm-ragi', 'Ragi', 'Millets', 'Indaf 9', '₹/quintal'],
    ['comm-tomato', 'Tomato', 'Vegetables', 'Local Red', '₹/quintal'],
    ['comm-onion', 'Onion', 'Vegetables', 'Nashik/Bellary Red', '₹/quintal'],
    ['comm-potato', 'Potato', 'Vegetables', 'Kufri Jyoti', '₹/quintal'],
    ['comm-cotton', 'Cotton', 'Fiber', 'DCH-32 Hybrid', '₹/quintal'],
    ['comm-soybean', 'Soybean', 'Oilseeds', 'JS 335', '₹/quintal'],
    ['comm-groundnut', 'Groundnut', 'Oilseeds', 'TMV-2 Pods', '₹/quintal'],
    ['comm-turmeric', 'Turmeric', 'Spices', 'Salem Raw', '₹/quintal'],
    ['comm-chilli', 'Chilli', 'Spices', 'Byadagi Red', '₹/quintal']
  ];

  commodityList.forEach(c => {
    db.run(`INSERT OR IGNORE INTO commodities (id, name, category, variety, unit) VALUES (?, ?, ?, ?, ?)`, c);
  });

  // 10. Seed 30 Consecutive Historical Dates for each commodity across Karnataka Mandis (Part 3)
  // Generating deterministic historical records with source = 'DEMO_SEED', data_status = 'DEMO'
  const commodityBasePrices: Record<string, { base: number; market: string; marketName: string; district: string; variety: string }> = {
    'comm-basmati-rice': { base: 4300, market: 'mandi-bengaluru', marketName: 'Bengaluru APMC', district: 'Bengaluru Urban', variety: 'Pusa 1121' },
    'comm-rice': { base: 3100, market: 'mandi-bengaluru', marketName: 'Bengaluru APMC', district: 'Bengaluru Urban', variety: 'Sona Masuri' },
    'comm-wheat': { base: 2700, market: 'mandi-mysuru', marketName: 'Mysuru APMC', district: 'Mysuru', variety: 'Sharbati' },
    'comm-maize': { base: 2150, market: 'mandi-davanagere', marketName: 'Davanagere APMC', district: 'Davanagere', variety: 'Yellow Corn' },
    'comm-ragi': { base: 3500, market: 'mandi-davanagere', marketName: 'Davanagere APMC', district: 'Davanagere', variety: 'Indaf 9' },
    'comm-tomato': { base: 1700, market: 'mandi-kolar', marketName: 'Kolar APMC', district: 'Kolar', variety: 'Local Red' },
    'comm-onion': { base: 2200, market: 'mandi-hubballi', marketName: 'Hubballi APMC', district: 'Dharwad', variety: 'Red Medium' },
    'comm-potato': { base: 1750, market: 'mandi-belagavi', marketName: 'Belagavi APMC', district: 'Belagavi', variety: 'Jyoti' },
    'comm-cotton': { base: 7200, market: 'mandi-raichur', marketName: 'Raichur APMC', district: 'Raichur', variety: 'DCH-32' },
    'comm-soybean': { base: 4400, market: 'mandi-belagavi', marketName: 'Belagavi APMC', district: 'Belagavi', variety: 'Yellow' },
    'comm-groundnut': { base: 5600, market: 'mandi-raichur', marketName: 'Raichur APMC', district: 'Raichur', variety: 'TMV-2 Pods' },
    'comm-turmeric': { base: 12500, market: 'mandi-shivamogga', marketName: 'Shivamogga APMC', district: 'Shivamogga', variety: 'Salem Raw' },
    'comm-chilli': { base: 18500, market: 'mandi-hubballi', marketName: 'Hubballi APMC', district: 'Dharwad', variety: 'Byadagi Red' }
  };

  // Generate 30 consecutive dates up to today
  for (let dayIdx = 29; dayIdx >= 0; dayIdx--) {
    const recordDate = new Date(nowTs - dayIdx * 86400000).toISOString().split('T')[0];
    const recordTimestamp = nowTs - dayIdx * 86400000;

    Object.entries(commodityBasePrices).forEach(([commId, meta]) => {
      // Deterministic price calculation: base + sine curve + slight trend
      const variance = Math.sin((30 - dayIdx) / 4) * (meta.base * 0.05);
      const trendDrift = (30 - dayIdx) * (meta.base * 0.002);
      const modal = Math.round(meta.base + variance + trendDrift);
      const min = Math.round(modal * 0.92);
      const max = Math.round(modal * 1.08);

      const priceId = `mp-${commId}-${meta.market}-${recordDate}`;

      db.run(
        `INSERT OR IGNORE INTO market_prices (
          id, commodity_id, commodity_name, variety, market_id, market_name,
          district, state, arrival_date, min_price, max_price, modal_price,
          unit, currency, source, source_record_id, fetched_at, data_status, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          priceId,
          commId,
          commodityList.find(c => c[0] === commId)?.[1] || 'Commodity',
          meta.variety,
          meta.market,
          meta.marketName,
          meta.district,
          'Karnataka',
          recordDate,
          min,
          max,
          modal,
          'quintal',
          'INR',
          'DEMO_SEED',
          `demo-${commId}-${dayIdx}`,
          recordTimestamp,
          'DEMO',
          recordTimestamp
        ]
      );

      // Also add comparison quote in secondary market for comparison
      if (dayIdx === 0) {
        const secondaryMarket = meta.market === 'mandi-bengaluru' ? 'mandi-kolar' : 'mandi-bengaluru';
        const secMarketName = secondaryMarket === 'mandi-kolar' ? 'Kolar APMC' : 'Bengaluru APMC';
        const secDistrict = secondaryMarket === 'mandi-kolar' ? 'Kolar' : 'Bengaluru Urban';
        const secModal = Math.round(modal * 1.03);

        db.run(
          `INSERT OR IGNORE INTO market_prices (
            id, commodity_id, commodity_name, variety, market_id, market_name,
            district, state, arrival_date, min_price, max_price, modal_price,
            unit, currency, source, source_record_id, fetched_at, data_status, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `mp-${commId}-${secondaryMarket}-${recordDate}`,
            commId,
            commodityList.find(c => c[0] === commId)?.[1] || 'Commodity',
            meta.variety,
            secondaryMarket,
            secMarketName,
            secDistrict,
            'Karnataka',
            recordDate,
            Math.round(secModal * 0.91),
            Math.round(secModal * 1.09),
            secModal,
            'quintal',
            'INR',
            'DEMO_SEED',
            `demo-sec-${commId}`,
            recordTimestamp,
            'DEMO',
            recordTimestamp
          ]
        );
      }
    });
  }

  // 11. Seed Default Commodity Watchlist
  db.run(`INSERT OR IGNORE INTO commodity_watchlists (id, user_id, commodity_id, market_id, created_at)
    VALUES ('cw-1', 'user-1', 'comm-tomato', 'mandi-kolar', ?)`, [nowTs]);
  db.run(`INSERT OR IGNORE INTO commodity_watchlists (id, user_id, commodity_id, market_id, created_at)
    VALUES ('cw-2', 'user-1', 'comm-ragi', 'mandi-davanagere', ?)`, [nowTs]);

  // 12. Seed Notifications (Authentic real records)
  db.run(`INSERT OR IGNORE INTO notifications (id, user_id, title, message, category, severity, related_id, source, timestamp, is_read, action_url)
    VALUES ('notif-1', 'user-1', 'Optimal Soil Moisture', 'Zone A capacitive moisture telemetry stabilized at 58.5%. Cation exchange intact.', 'SOIL_MOISTURE', 'SUCCESS', 'zone-a', 'ESP32-01', ?, 0, '/sensors')`,
    [nowTs - 1800000]);

  db.run(`INSERT OR IGNORE INTO notifications (id, user_id, title, message, category, severity, related_id, source, timestamp, is_read, action_url)
    VALUES ('notif-2', 'user-1', 'Mandi Price Opportunity', 'Tomato modal price at Kolar APMC increased to ₹1,820/quintal. Favorable sell window active.', 'MARKET_PRICE_ALERT', 'INFO', 'comm-tomato', 'DEMO_SEED', ?, 0, '/market')`,
    [nowTs - 3600000]);

  db.run(`INSERT OR IGNORE INTO notifications (id, user_id, title, message, category, severity, related_id, source, timestamp, is_read, action_url)
    VALUES ('notif-3', 'user-1', 'Fertilization Scheduled', 'Zone A Tomato foliar micronutrient application is due tomorrow.', 'FARM_ACTIVITY', 'INFO', 'act-2', 'CALENDAR', ?, 0, '/virtual-farm')`,
    [nowTs - 7200000]);

  db.run(`SELECT 1`, (err) => {
    if (err) reject(err);
    else resolve();
  });
}
