import express from "express";
import { loadPlan, savePlan, listPlans, deletePlan, renamePlan } from "./utils.js";
import {
  calculate,
  addItem,
  deleteItem,
  updateItem,
  addType,
  deleteType,
  updateType,
  createNextMonth,
  reorderItems
} from "./service.js";

const router = express.Router();

// Получить список всех планов
router.get("/plans", (req, res) => {
  const months = listPlans();
  const plans = months.map(m => {
    const plan = loadPlan(m);
    return { month: m, ...calculate(plan) };
  });
  res.json(plans);
});

// Получить конкретный план
router.get("/plan/:month", (req, res) => {
  const plan = loadPlan(req.params.month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const calc = calculate(plan);
  res.json({ plan, calc });
});

// Создать новый план
router.post("/plan", (req, res) => {
  const { month, startBalance, types } = req.body;
  const plan = {
    month,
    startBalance: startBalance || 0,
    types: types || []
  };
  savePlan(plan);
  res.json({ plan, calc: calculate(plan) });
});

// Удалить план
router.delete("/plan/:month", (req, res) => {
  const deleted = deletePlan(req.params.month);
  if (!deleted) return res.status(404).json({ error: "Plan not found" });
  res.json({ success: true });
});

// Переименовать план (изменить месяц/дату)
router.put("/plan/:month", (req, res) => {
  const { newMonth, startBalance } = req.body;
  const plan = loadPlan(req.params.month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  if (newMonth && newMonth !== req.params.month) {
    renamePlan(req.params.month, newMonth);
    plan.month = newMonth;
  }
  if (startBalance !== undefined) {
    plan.startBalance = startBalance;
  }
  savePlan(plan);
  res.json({ plan, calc: calculate(plan) });
});

// Обновить startBalance
router.put("/plan/:month/balance", (req, res) => {
  const plan = loadPlan(req.params.month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  plan.startBalance = req.body.startBalance;
  savePlan(plan);
  res.json({ plan, calc: calculate(plan) });
});

// Добавить элемент (затрату)
router.post("/item", (req, res) => {
  const { month, type, name, amount, note, paid } = req.body;
  const plan = loadPlan(month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  addItem(plan, type, { name, amount: Number(amount), note: note || "", paid: !!paid });
  savePlan(plan);
  res.json({ plan, calc: calculate(plan) });
});

// Обновить элемент
router.put("/item/:itemId", (req, res) => {
  const { month, type, name, amount, note, paid } = req.body;
  const plan = loadPlan(month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const updates = { name, amount: Number(amount) };
  if (note !== undefined) updates.note = note;
  if (paid !== undefined) updates.paid = !!paid;
  updateItem(plan, type, req.params.itemId, updates);
  savePlan(plan);
  res.json({ plan, calc: calculate(plan) });
});

// Удалить элемент
router.delete("/item", (req, res) => {
  const { month, type, itemId } = req.body;
  const plan = loadPlan(month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  deleteItem(plan, type, itemId);
  savePlan(plan);
  res.json({ plan, calc: calculate(plan) });
});

// Reorder items внутри типа
router.post("/reorder", (req, res) => {
  const { month, type, itemIds } = req.body;
  const plan = loadPlan(month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  reorderItems(plan, type, itemIds);
  savePlan(plan);
  res.json({ plan, calc: calculate(plan) });
});

// Добавить тип затрат
router.post("/type", (req, res) => {
  const { month, typeName, budget, carryOver, color } = req.body;
  const plan = loadPlan(month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  addType(plan, typeName, budget || 0, color || "#7c6ff7");
  if (carryOver !== undefined) {
    updateType(plan, typeName, { carryOver: !!carryOver });
  }
  savePlan(plan);
  res.json({ plan, calc: calculate(plan) });
});

// Удалить тип затрат
router.delete("/type", (req, res) => {
  const { month, typeName } = req.body;
  const plan = loadPlan(month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  deleteType(plan, typeName);
  savePlan(plan);
  res.json({ plan, calc: calculate(plan) });
});

// Обновить тип затрат
router.put("/type", (req, res) => {
  const { month, oldName, newName, budget, carryOver, note, color } = req.body;
  const plan = loadPlan(month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const updates = {};
  if (newName !== undefined) updates.name = newName;
  if (budget !== undefined) updates.budget = budget;
  if (color !== undefined) updates.color = color;
  if (carryOver !== undefined) updates.carryOver = !!carryOver;
  if (note !== undefined) updates.note = note;
  updateType(plan, oldName, updates);
  savePlan(plan);
  res.json({ plan, calc: calculate(plan) });
});

// Создать план на следующий месяц
router.post("/next-month", (req, res) => {
  const { month } = req.body;
  const plan = loadPlan(month);
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  // Авто-расчёт следующего месяца
  const [m, y] = month.split(".").map(Number);
  let nextM = m + 1;
  let nextY = y;
  if (nextM > 12) {
    nextM = 1;
    nextY++;
  }
  const newMonth = `${String(nextM).padStart(2, "0")}.${nextY}`;

  const newPlan = createNextMonth(plan, newMonth);
  savePlan(newPlan);
  res.json({ plan: newPlan, calc: calculate(newPlan) });
});

export default router;
