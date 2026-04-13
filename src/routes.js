import express from "express";
import { loadPlan, savePlan } from "./utils.js";
import { calculate, addItem, deleteItem, createNextMonth } from "./service.js";

const router = express.Router();

router.get("/plan/:month", (req, res) => {
  const plan = loadPlan(req.params.month);
  const calc = calculate(plan);
  res.json({ plan, calc });
});

router.post("/item", (req, res) => {
  const { month, type, name, amount } = req.body;

  const plan = loadPlan(month);
  addItem(plan, type, { name, amount });

  savePlan(plan);
  res.json({ success: true });
});

router.delete("/item", (req, res) => {
  const { month, type, name } = req.body;

  const plan = loadPlan(month);
  deleteItem(plan, type, name);

  savePlan(plan);
  res.json({ success: true });
});

router.post("/next-month", (req, res) => {
  const { month, newMonth } = req.body;

  const plan = loadPlan(month);
  const newPlan = createNextMonth(plan, newMonth);

  savePlan(newPlan);
  res.json(newPlan);
});

export default router;