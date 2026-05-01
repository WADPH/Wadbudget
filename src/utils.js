import fs from "fs";
import path from "path";

const DATA_DIR = "./data";

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getPlanPath(month) {
  return path.join(DATA_DIR, `${month}.json`);
}

export function loadPlan(month, migrate = true) {
  ensureDir();
  const p = getPlanPath(month);
  if (!fs.existsSync(p)) {
    return null;
  }
  const plan = JSON.parse(fs.readFileSync(p, "utf-8"));
  // Migrate: ensure all items have IDs and paid flag
  if (migrate) {
    let changed = false;
    for (const type of plan.types) {
      for (const item of type.items) {
        if (!item.id) {
          item.id = `legacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          changed = true;
        }
        if (typeof item.paid !== "boolean") {
          item.paid = false;
          changed = true;
        }
      }
    }
    if (changed) {
      savePlan(plan);
    }
  }
  return plan;
}

export function savePlan(plan) {
  ensureDir();
  const p = getPlanPath(plan.month);
  fs.writeFileSync(p, JSON.stringify(plan, null, 2));
}

export function renamePlan(oldMonth, newMonth) {
  const oldPath = getPlanPath(oldMonth);
  const newPath = getPlanPath(newMonth);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
}

export function deletePlan(month) {
  const p = getPlanPath(month);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    return true;
  }
  return false;
}

export function listPlans() {
  ensureDir();
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  // Sort by date: MM.YYYY format
  return files.map(f => f.replace(".json", "")).sort((a, b) => {
    const [ma, ya] = a.split(".").map(Number);
    const [mb, yb] = b.split(".").map(Number);
    return (ya * 12 + ma) - (yb * 12 + mb);
  });
}

export function existsPlan(month) {
  return fs.existsSync(getPlanPath(month));
}
