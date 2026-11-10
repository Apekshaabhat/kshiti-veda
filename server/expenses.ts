import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from './database';
import { triggerNotification } from './notifications';

export const expenseRouter = Router();

export interface ExpenseRecord {
  id: string;
  user_id: string;
  farm_id: string;
  zone_id?: string | null;
  category: string;
  description?: string | null;
  amount: number;
  currency: string;
  quantity?: number | null;
  unit?: string | null;
  purchase_date: string;
  vendor?: string | null;
  payment_method?: string | null;
  payment_status: 'PAID' | 'PENDING' | 'OVERDUE';
  due_date?: string | null;
  invoice_number?: string | null;
  receipt_attachment?: string | null;
  notes?: string | null;
  created_at: number;
  updated_at: number;
}

// Evaluate budgets and dispatch budget alerts if expenditure exceeds threshold
async function checkBudgetAlerts(farmId: string, category: string, currentTotal: number) {
  try {
    const budgets = await dbAll<any>(
      `SELECT * FROM farm_budgets WHERE farm_id = ? AND (category = ? OR category = 'Total')`,
      [farmId, category]
    );

    for (const b of budgets) {
      const budgetLimit = b.monthly_budget;
      const thresholdPct = b.alert_threshold_percent || 85.0;
      const pctUsed = (currentTotal / budgetLimit) * 100;

      if (pctUsed >= thresholdPct) {
        const severity = pctUsed >= 100 ? 'CRITICAL' : 'WARNING';
        const title = pctUsed >= 100 ? `Budget Exceeded: ${b.category}` : `Budget Warning: ${b.category} at ${pctUsed.toFixed(0)}%`;
        const msg = `Farm spending for ${b.category} reached ₹${currentTotal.toLocaleString()} of the monthly budget of ₹${budgetLimit.toLocaleString()} (${pctUsed.toFixed(1)}%).`;

        await triggerNotification({
          userId: b.user_id,
          title,
          message: msg,
          category: 'BUDGET_ALERT',
          severity,
          relatedId: farmId,
          source: 'FINANCE',
          actionUrl: '/expenses'
        });
      }
    }
  } catch (e) {
    console.warn('[Budget Engine] Evaluation error:', e);
  }
}

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

// GET /api/expenses - List expenses with filters, vendor search & pagination
expenseRouter.get('/', async (req: Request, res: Response) => {
  try {
    const farmId = req.query.farm_id as string;
    const zoneId = req.query.zone_id as string;
    const category = req.query.category as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = (page - 1) * limit;

    let sql = `
      SELECT e.*, f.name as farm_name, z.name as zone_name
      FROM expenses e
      LEFT JOIN farms f ON e.farm_id = f.id
      LEFT JOIN farm_zones z ON e.zone_id = z.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (farmId) {
      sql += ` AND e.farm_id = ?`;
      params.push(farmId);
    }
    if (zoneId) {
      sql += ` AND e.zone_id = ?`;
      params.push(zoneId);
    }
    if (category) {
      sql += ` AND e.category = ?`;
      params.push(category);
    }
    if (status) {
      sql += ` AND e.payment_status = ?`;
      params.push(status.toUpperCase());
    }
    if (dateFrom) {
      sql += ` AND e.purchase_date >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ` AND e.purchase_date <= ?`;
      params.push(dateTo);
    }
    if (search) {
      sql += ` AND (e.description LIKE ? OR e.vendor LIKE ? OR e.invoice_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countSql = sql.replace('SELECT e.*, f.name as farm_name, z.name as zone_name', 'SELECT COUNT(*) as total');
    const totalRow = await dbGet<{ total: number }>(countSql, params);
    const total = totalRow?.total || 0;

    sql += ` ORDER BY e.purchase_date DESC, e.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const items = await dbAll<ExpenseRecord>(sql, params);

    res.json({
      expenses: items,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit)
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve expenses: ' + err.message });
  }
});

// GET /api/expenses/summary - Complete financial KPI and category aggregation
expenseRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const farmId = (req.query.farm_id as string) || 'farm-1';

    const allExpenses = await dbAll<ExpenseRecord>(
      `SELECT * FROM expenses WHERE farm_id = ?`,
      [farmId]
    );

    const totalSpending = allExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Paid, Pending, Overdue totals
    const paidTotal = allExpenses.filter(e => e.payment_status === 'PAID').reduce((sum, e) => sum + e.amount, 0);
    const pendingTotal = allExpenses.filter(e => e.payment_status === 'PENDING').reduce((sum, e) => sum + e.amount, 0);
    const overdueTotal = allExpenses.filter(e => e.payment_status === 'OVERDUE').reduce((sum, e) => sum + e.amount, 0);

    // Category breakdown
    const categoryMap: Record<string, number> = {};
    allExpenses.forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });

    const categoryBreakdown = Object.entries(categoryMap).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpending > 0 ? Number(((amount / totalSpending) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.amount - a.amount);

    // Monthly breakdown for last 6 months
    const now = new Date();
    const monthlyTrends: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString([], { month: 'short', year: '2-digit' });
      const ymPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      const monthAmount = allExpenses
        .filter(e => e.purchase_date.startsWith(ymPrefix))
        .reduce((sum, e) => sum + e.amount, 0);

      monthlyTrends.push({ month: monthStr, amount: monthAmount });
    }

    // Budgets comparison
    const budgets = await dbAll<any>(`SELECT * FROM farm_budgets WHERE farm_id = ?`, [farmId]);
    const budgetTotal = budgets.find(b => b.category === 'Total')?.monthly_budget || 120000;
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthExpenses = allExpenses
      .filter(e => e.purchase_date.startsWith(currentMonthPrefix))
      .reduce((sum, e) => sum + e.amount, 0);

    // Estimated revenue from active harvests (if recorded)
    const estimatedRevenue = 280000; // Benchmark seasonal revenue
    const netProfit = estimatedRevenue - totalSpending;
    const profitMargin = estimatedRevenue > 0 ? Number(((netProfit / estimatedRevenue) * 100).toFixed(1)) : 0;

    res.json({
      farm_id: farmId,
      currency: 'INR',
      total_expenditure: totalSpending,
      current_month_expenditure: currentMonthExpenses,
      monthly_budget: budgetTotal,
      budget_utilization_pct: Number(((currentMonthExpenses / budgetTotal) * 100).toFixed(1)),
      paid_total: paidTotal,
      pending_total: pendingTotal,
      overdue_total: overdueTotal,
      expense_count: allExpenses.length,
      category_breakdown: categoryBreakdown,
      monthly_trends: monthlyTrends,
      profitability: {
        recorded_revenue: estimatedRevenue,
        total_costs: totalSpending,
        net_profit: netProfit,
        profit_margin_pct: profitMargin
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/categories - List categories
expenseRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    const rows = await dbAll(`SELECT * FROM expense_categories ORDER BY name ASC`);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses/categories - Add custom category
expenseRouter.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const id = `cat-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    await dbRun(
      `INSERT INTO expense_categories (id, name, icon, is_default) VALUES (?, ?, ?, 0)
       ON CONFLICT(name) DO UPDATE SET icon = excluded.icon`,
      [id, name, icon || 'Receipt']
    );
    res.status(201).json({ id, name, icon: icon || 'Receipt' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/budgets - List budgets
expenseRouter.get('/budgets', async (req: Request, res: Response) => {
  try {
    const farmId = (req.query.farm_id as string) || 'farm-1';
    const rows = await dbAll(`SELECT * FROM farm_budgets WHERE farm_id = ?`, [farmId]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses/budgets - Set farm budget
expenseRouter.post('/budgets', async (req: Request, res: Response) => {
  try {
    const { farm_id, category, monthly_budget, annual_budget, alert_threshold } = req.body;
    if (!farm_id || !category || !monthly_budget) {
      return res.status(400).json({ error: 'farm_id, category, and monthly_budget are required' });
    }

    const id = `bgt-${farm_id}-${category.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const mBudget = parseFloat(monthly_budget);
    const aBudget = annual_budget ? parseFloat(annual_budget) : mBudget * 12;

    await dbRun(
      `INSERT INTO farm_budgets (id, user_id, farm_id, category, monthly_budget, annual_budget, alert_threshold_percent)
       VALUES (?, 'user-1', ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         monthly_budget = excluded.monthly_budget,
         annual_budget = excluded.annual_budget,
         alert_threshold_percent = excluded.alert_threshold_percent`,
      [id, farm_id, category, mBudget, aBudget, alert_threshold ? parseFloat(alert_threshold) : 85.0]
    );

    res.status(201).json({ id, farm_id, category, monthly_budget: mBudget, annual_budget: aBudget });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/:id - Single expense
expenseRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await dbGet<ExpenseRecord>(`SELECT * FROM expenses WHERE id = ?`, [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Expense record not found' });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses - Create new expense with validation
expenseRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      farm_id, zone_id, category, description, amount, quantity, unit,
      purchase_date, vendor, payment_method, payment_status, due_date, invoice_number, notes
    } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a valid positive number' });
    }
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const id = req.body.id || `exp-${Date.now()}`;
    const now = Date.now();
    const cleanDate = purchase_date ? purchase_date.split('T')[0] : new Date().toISOString().split('T')[0];

    const newExpense: ExpenseRecord = {
      id,
      user_id: req.body.user_id || 'user-1',
      farm_id: farm_id || 'farm-1',
      zone_id: zone_id || null,
      category,
      description: description || notes || `${category} purchase`,
      amount: parseFloat(Number(amount).toFixed(2)),
      currency: 'INR',
      quantity: quantity ? parseFloat(quantity) : null,
      unit: unit || null,
      purchase_date: cleanDate,
      vendor: vendor || null,
      payment_method: payment_method || 'UPI',
      payment_status: payment_status || 'PAID',
      due_date: due_date || null,
      invoice_number: invoice_number || null,
      receipt_attachment: req.body.receipt_attachment || null,
      notes: notes || null,
      created_at: now,
      updated_at: now
    };

    await dbRun(
      `INSERT INTO expenses (
        id, user_id, farm_id, zone_id, category, description, amount, currency,
        quantity, unit, purchase_date, vendor, payment_method, payment_status,
        due_date, invoice_number, receipt_attachment, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newExpense.id, newExpense.user_id, newExpense.farm_id, newExpense.zone_id,
        newExpense.category, newExpense.description, newExpense.amount, newExpense.currency,
        newExpense.quantity, newExpense.unit, newExpense.purchase_date, newExpense.vendor,
        newExpense.payment_method, newExpense.payment_status, newExpense.due_date,
        newExpense.invoice_number, newExpense.receipt_attachment, newExpense.notes,
        newExpense.created_at, newExpense.updated_at
      ]
    );

    // Trigger budget checks in background
    checkBudgetAlerts(newExpense.farm_id, newExpense.category, newExpense.amount);

    res.status(201).json(newExpense);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create expense: ' + err.message });
  }
});

// PUT /api/expenses/:id - Edit expense
expenseRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await dbGet<ExpenseRecord>(`SELECT * FROM expenses WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Expense record not found' });

    const {
      category, description, amount, quantity, unit, purchase_date,
      vendor, payment_method, payment_status, due_date, invoice_number, notes
    } = req.body;

    const updatedAmount = amount ? parseFloat(amount) : existing.amount;
    if (updatedAmount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

    await dbRun(
      `UPDATE expenses SET
         category = ?, description = ?, amount = ?, quantity = ?, unit = ?,
         purchase_date = ?, vendor = ?, payment_method = ?, payment_status = ?,
         due_date = ?, invoice_number = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        category || existing.category,
        description !== undefined ? description : existing.description,
        updatedAmount,
        quantity !== undefined ? quantity : existing.quantity,
        unit !== undefined ? unit : existing.unit,
        purchase_date || existing.purchase_date,
        vendor !== undefined ? vendor : existing.vendor,
        payment_method || existing.payment_method,
        payment_status || existing.payment_status,
        due_date !== undefined ? due_date : existing.due_date,
        invoice_number !== undefined ? invoice_number : existing.invoice_number,
        notes !== undefined ? notes : existing.notes,
        Date.now(),
        req.params.id
      ]
    );

    const updated = await dbGet(`SELECT * FROM expenses WHERE id = ?`, [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/expenses/:id/status - Quick toggle payment status
expenseRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { payment_status } = req.body;
    if (!payment_status || !['PAID', 'PENDING', 'OVERDUE'].includes(payment_status.toUpperCase())) {
      return res.status(400).json({ error: 'Valid payment_status (PAID, PENDING, OVERDUE) is required' });
    }

    await dbRun(
      `UPDATE expenses SET payment_status = ?, updated_at = ? WHERE id = ?`,
      [payment_status.toUpperCase(), Date.now(), req.params.id]
    );

    res.json({ success: true, id: req.params.id, payment_status: payment_status.toUpperCase() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id - Delete expense record
expenseRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await dbRun(`DELETE FROM expenses WHERE id = ?`, [req.params.id]);
    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

