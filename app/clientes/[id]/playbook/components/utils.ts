import { ReviewFlag } from '@/lib/types/playbook'

// ── Currency ──────────────────────────────────────────────────────────────────

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// ── Relação labels ────────────────────────────────────────────────────────────
// Maps IRPF numeric codes and common raw strings to human-readable labels.

const RELACAO_MAP: Record<string, string> = {
  '01': 'Cônjuge',
  '02': 'Companheiro(a)',
  '03': 'Filho(a)',
  '04': 'Enteado(a)',
  '05': 'Neto(a) ou Bisneto(a)',
  '06': 'Pai / Mãe / Avô / Avó',
  '07': 'Menor pobre',
  '08': 'Incapaz sob curatela',
  '09': 'Irmão(ã)',
  '10': 'Enteado(a) com deficiência',
  '11': 'Filho(a) com deficiência',
  '12': 'Irmão(ã) com deficiência',
  '21': 'Filho(a)',
  '22': 'Cônjuge',
  '25': 'Companheiro(a)',
  'conjuge': 'Cônjuge',
  'filho': 'Filho(a)',
  'filha': 'Filha',
  'enteado': 'Enteado(a)',
  'neto': 'Neto(a)',
  'irmao': 'Irmão(ã)',
  'pai': 'Pai',
  'mae': 'Mãe',
  'avo': 'Avô / Avó',
}

export function resolveRelacao(raw: string): string {
  if (!raw) return '—'
  const key = raw.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return (
    RELACAO_MAP[raw.trim()] ??
    RELACAO_MAP[key] ??
    raw
  )
}

// ── Review flags ──────────────────────────────────────────────────────────────

export function flagClasses(severity: ReviewFlag['severity']): string {
  const map: Record<ReviewFlag['severity'], string> = {
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    warning: 'border-olive-200 bg-amber-50 text-olive-700',
    required: 'border-red-200 bg-red-50 text-red-700',
  }
  return map[severity]
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}
