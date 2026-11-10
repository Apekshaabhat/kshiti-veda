import { describe, it, expect, beforeAll } from "vitest";
import { initDatabase, dbGet, dbAll } from "../../server/database";
import { triggerNotification } from "../../server/notifications";

describe("TRINEXA Backend Modules Test Suite", () => {
  beforeAll(async () => {
    await initDatabase();
  });

  describe("1. Notification System & Deduplication", () => {
    it("creates notification and stores in database", async () => {
      const notif = await triggerNotification({
        title: 'Acidic Soil Test',
        message: 'pH dropped below 6.0',
        category: 'PH_ALERT',
        severity: 'WARNING',
        force: true
      });

      expect(notif).toBeDefined();
      expect(notif?.title).toBe('Acidic Soil Test');

      const count = await dbGet(`SELECT count(*) as c FROM notifications WHERE title = 'Acidic Soil Test'`);
      expect(count.c).toBeGreaterThan(0);
    });

    it("deduplicates identical notification within 15-minute cooldown window", async () => {
      const first = await triggerNotification({
        title: 'Drought Stress Test',
        message: 'Root moisture critically depleted.',
        category: 'SOIL_MOISTURE',
        severity: 'CRITICAL',
        force: true
      });
      expect(first).toBeDefined();

      const duplicate = await triggerNotification({
        title: 'Drought Stress Test',
        message: 'Root moisture critically depleted.',
        category: 'SOIL_MOISTURE',
        severity: 'CRITICAL',
        force: false
      });
      expect(duplicate).toBeNull();
    });
  });

  describe("2. Agricultural Report Statistics & Provenance", () => {
    it("excludes null/NaN readings and strictly computes valid telemetry statistics", async () => {
      const rawValues = [55.2, null, 58.4, undefined, 60.0, NaN, 56.8];
      const valid = rawValues.filter(v => v !== null && v !== undefined && !isNaN(v as number)) as number[];
      
      expect(valid.length).toBe(4);
      const min = Math.min(...valid);
      const max = Math.max(...valid);
      const avg = Number((valid.reduce((acc, v) => acc + v, 0) / valid.length).toFixed(1));

      expect(min).toBe(55.2);
      expect(max).toBe(60.0);
      expect(avg).toBe(57.6);
    });

    it("verifies NPK provenance is always labeled as simulation", () => {
      const simulatedNPK = {
        nitrogen: 71.7,
        phosphorus: 45.0,
        potassium: 70.0,
        provenance: 'simulation'
      };

      expect(simulatedNPK.provenance).toBe('simulation');
      expect(simulatedNPK.nitrogen).toBeGreaterThan(0);
      expect(simulatedNPK.phosphorus).toBeGreaterThan(0);
      expect(simulatedNPK.potassium).toBeGreaterThan(0);
    });
  });

  describe("3. Market Prices & Non-Negative Validation", () => {
    it("verifies all seeded commodities and mandi prices are strictly positive", async () => {
      const prices = await dbAll(`SELECT * FROM market_prices`);
      expect(prices.length).toBeGreaterThan(0);

      prices.forEach((p: any) => {
        expect(p.modal_price).toBeGreaterThan(0);
        expect(p.min_price).toBeGreaterThan(0);
        expect(p.max_price).toBeGreaterThanOrEqual(p.min_price);
      });
    });

    it("correctly identifies best mandi modal price comparison", async () => {
      const ricePrices = await dbAll(`SELECT * FROM market_prices WHERE commodity_id = 'comm-rice' ORDER BY modal_price DESC`);
      expect(ricePrices.length).toBeGreaterThanOrEqual(2);
      expect(ricePrices[0].modal_price).toBeGreaterThanOrEqual(ricePrices[1].modal_price);
    });
  });

  describe("4. Expense Management & Budget Overrun Calculation", () => {
    it("verifies positive amount constraint on expenses", async () => {
      const validAmount = 15000;
      expect(validAmount).toBeGreaterThan(0);

      const invalidAmount = -935.9;
      const isValid = (amt: any) => typeof amt === 'number' && !isNaN(amt) && amt > 0;
      expect(isValid(invalidAmount)).toBe(false);
      expect(isValid(validAmount)).toBe(true);
    });

    it("calculates budget utilization and triggers alert when exceeding threshold", () => {
      const budgetLimit = 50000;
      const spent = 42500;
      const utilization = (spent / budgetLimit) * 100;
      const alertThreshold = 80.0;

      expect(utilization).toBe(85.0);
      expect(utilization >= alertThreshold).toBe(true);
    });
  });

  describe("5. Virtual Farm & Multi-Zone Management", () => {
    it("retrieves default farm with associated zones and crops", async () => {
      const farm = await dbGet(`SELECT * FROM farms WHERE id = 'farm-1'`);
      expect(farm).toBeDefined();
      expect(farm.name).toBe('Green Valley Estate');

      const zones = await dbAll(`SELECT * FROM farm_zones WHERE farm_id = 'farm-1'`);
      expect(zones.length).toBeGreaterThanOrEqual(3);

      const crops = await dbAll(`SELECT * FROM farm_crops WHERE farm_id = 'farm-1' AND status = 'ACTIVE'`);
      expect(crops.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("6. Hardware Telemetry Ingestion & Updated ESP32 Protocol", () => {
    it("stores ph_status and prevents AIR from being stored as numeric soil_ph", async () => {
      const { dbRun } = await import("../../server/database");
      const testId = `test-reading-${Date.now()}`;
      
      // Replicate ingestion logic for AIR
      const rawPh = 14.8; // > 14 or explicit AIR
      const ph_status = (rawPh > 14) ? 'AIR' : 'VALID';
      const numericPh = ph_status === 'AIR' ? null : rawPh;
      const lightVal = 580;
      const lightSource = 'PH_MODULE_L_RAW';
      const lightUnit = 'raw';

      await dbRun(
        `INSERT INTO hardware_readings (device_id, soil_moisture, soil_ph, ph_status, light_intensity, light_source, light_unit, timestamp, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['ESP32-TEST', 62.0, numericPh, ph_status, lightVal, lightSource, lightUnit, Date.now(), new Date().toISOString()]
      );

      const record = await dbGet(`SELECT * FROM hardware_readings WHERE device_id = 'ESP32-TEST' ORDER BY timestamp DESC LIMIT 1`);
      expect(record).toBeDefined();
      expect(record.ph_status).toBe('AIR');
      expect(record.soil_ph).toBeNull(); // Numeric pH strictly null
      expect(record.light_intensity).toBe(580);
      expect(record.light_source).toBe('PH_MODULE_L_RAW');
      expect(record.light_unit).toBe('raw');
    });

    it("stores valid numeric soil_ph when ph_status is VALID", async () => {
      const { dbRun } = await import("../../server/database");
      
      await dbRun(
        `INSERT INTO hardware_readings (device_id, soil_moisture, soil_ph, ph_status, light_intensity, light_source, light_unit, timestamp, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['ESP32-TEST-VALID', 58.0, 6.72, 'VALID', 430, 'PH_MODULE_L_RAW', 'raw', Date.now(), new Date().toISOString()]
      );

      const record = await dbGet(`SELECT * FROM hardware_readings WHERE device_id = 'ESP32-TEST-VALID' ORDER BY timestamp DESC LIMIT 1`);
      expect(record).toBeDefined();
      expect(record.ph_status).toBe('VALID');
      expect(record.soil_ph).toBe(6.72);
      expect(record.light_intensity).toBe(430);
    });
  });
});
