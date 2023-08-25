export function trim(hex: string): string {
  return hex.replace(/^(00)+/, '')
}