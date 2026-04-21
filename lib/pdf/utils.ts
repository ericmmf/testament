// Shared PDF utility functions

export function formatBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso   // return as-is if not parseable
  return d.toLocaleDateString('pt-BR')
}

export function formatCPF(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length !== 11) return raw ?? ''
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}
