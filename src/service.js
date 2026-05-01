export function calculate(plan) {
  let balance = plan.startBalance;

  const result = {
    totals: {},
    afterType: {},
    left: 0
  };

  for (const type of plan.types) {
    const total = type.items.reduce((sum, i) => sum + i.amount, 0);

    result.totals[type.name] = total;

    balance -= total;
    result.afterType[type.name] = balance;
  }

  result.left = balance;

  return result;
}

export function addItem(plan, typeName, item) {
  const type = plan.types.find(t => t.name === typeName);
  if (!type) throw new Error("Type not found");

  type.items.push({ id: Date.now().toString() + Math.random().toString(36).slice(2, 8), paid: false, ...item });
  return plan;
}

export function deleteItem(plan, typeName, itemId) {
  const type = plan.types.find(t => t.name === typeName);
  if (!type) throw new Error("Type not found");

  type.items = type.items.filter(i => i.id !== itemId);
  return plan;
}

export function updateItem(plan, typeName, itemId, updates) {
  const type = plan.types.find(t => t.name === typeName);
  if (!type) throw new Error("Type not found");

  const item = type.items.find(i => i.id === itemId);
  if (!item) throw new Error("Item not found");

  Object.assign(item, updates);
  return plan;
}

export function reorderItems(plan, typeName, itemIds) {
  const type = plan.types.find(t => t.name === typeName);
  if (!type) throw new Error("Type not found");

  const itemMap = new Map(type.items.map(i => [i.id, i]));
  type.items = itemIds.map(id => itemMap.get(id)).filter(Boolean);
  return plan;
}

export function addType(plan, typeName, budget = 0, color = "#7c6ff7") {
  plan.types.push({
    name: typeName,
    budget,
    color,
    carryOver: false,
    items: []
  });
  return plan;
}

export function deleteType(plan, typeName) {
  plan.types = plan.types.filter(t => t.name !== typeName);
  return plan;
}

export function updateType(plan, typeName, updates) {
  const type = plan.types.find(t => t.name === typeName);
  if (!type) throw new Error("Type not found");

  Object.assign(type, updates);
  return plan;
}

export function createNextMonth(plan, newMonth) {
  return {
    month: newMonth,
    startBalance: plan.startBalance,
    types: plan.types.map(type => ({
      name: type.name,
      budget: type.budget || 0,
      color: type.color || "#7c6ff7",
      carryOver: type.carryOver || false,
      items: type.carryOver
        ? type.items.map(i => ({ ...i, id: Date.now().toString() + Math.random().toString(36).slice(2, 8), paid: false }))
        : []
    }))
  };
}
