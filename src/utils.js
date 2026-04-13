import fs from "fs";

export function loadPlan(month) {
  const path = `./data/${month}.json`;
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

export function savePlan(plan) {
  const path = `./data/${plan.month}.json`;
  fs.writeFileSync(path, JSON.stringify(plan, null, 2));
}