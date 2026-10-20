'use strict';
function selectorFor(resource) {
  const selector = resource?.spec?.selector;
  if (typeof selector === 'string') return selector.trim();
  const labels = selector?.matchLabels || (selector && !selector.matchExpressions ? selector : {});
  const parts = Object.entries(labels).map(([key, value]) => `${key}=${value}`);
  for (const expression of selector?.matchExpressions || []) {
    const values = expression.values || [];
    if (expression.operator === 'In') parts.push(`${expression.key} in (${values.join(',')})`);
    else if (expression.operator === 'NotIn') parts.push(`${expression.key} notin (${values.join(',')})`);
    else if (expression.operator === 'Exists') parts.push(expression.key);
    else if (expression.operator === 'DoesNotExist') parts.push(`!${expression.key}`);
    else throw new Error(`Unsupported pod selector operator: ${expression.operator}`);
  }
  return parts.join(',');
}
module.exports = { selectorFor };
