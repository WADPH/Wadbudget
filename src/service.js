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

  type.items.push(item);
  return plan;
}

export function deleteItem(plan, typeName, itemName) {
  const type = plan.types.find(t => t.name === typeName);
  if (!type) throw new Error("Type not found");

  type.items = type.items.filter(i => i.name !== itemName);
  return plan;
}

export function createNextMonth(plan, newMonth) {
  return {
    month: newMonth,
    startBalance: plan.startBalance,
    types: plan.types.map(type => ({
      name: type.name,
      carryOver: type.carryOver,
      items: type.carryOver
        ? type.items.map(i => ({ ...i }))
        : []
    }))
  };
}