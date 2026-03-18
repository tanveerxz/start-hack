/**
 * Utility helper functions
 * Add reusable functions here
 */

export function formatDate(date: Date): string {
  // Placeholder implementation
  return date.toLocaleDateString();
}

export function formatCurrency(amount: number): string {
  // Placeholder implementation
  return `$${amount.toFixed(2)}`;
}

export function debounce<T extends (...args: never[]) => void>(
  func: T,
  wait: number
): T {
  // Placeholder implementation
  let timeout: NodeJS.Timeout;
  return ((...args: never[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}
