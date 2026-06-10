export function formatLabel(str) {
  if (!str) return str;
  return str.replace(/_/g, " ");
}
