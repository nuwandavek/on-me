// Finished try-ons, newest first: the order the side panel lists them and the chevrons step through.
export const comparisonOrder = records => records.filter(record => record.status === 'completed').sort((a,b) => b.createdAt - a.createdAt).map(record => record.id);

export function comparisonPlace(order,id) {
  const index = order.indexOf(id);
  return {position:index + 1,total:order.length,hasPrev:index > 0,hasNext:index >= 0 && index < order.length - 1};
}

export function stepTarget(order,id,direction) {
  if (direction !== -1 && direction !== 1) return null;
  const index = order.indexOf(id);
  return index < 0 ? null : order[index + direction] ?? null;
}
