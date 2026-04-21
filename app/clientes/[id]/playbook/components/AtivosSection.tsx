'use client'

import { useState, useRef, useEffect } from 'react'
import { AtivoFinanceiro, ReviewFlag, RecordAnexo, InstituicaoFinanceira, ContatoInstituicao, DestinoReclassificacao } from '@/lib/types/playbook'
import { formatBRL, flagClasses } from './utils'

// ── Brazilian financial institutions catalogue ────────────────────────────────

const INSTITUICOES_BR: { categoria: string; nomes: string[] }[] = [
  {
    categoria: 'Grandes Bancos',
    nomes: [
      'Itaú Unibanco',
      'Bradesco',
      'Banco do Brasil',
      'Santander Brasil',
      'Caixa Econômica Federal',
      'BTG Pactual',
      'Safra',
      'ABC Brasil',
      'BV (Banco Votorantim)',
      'Sicoob',
      'Sicredi',
      'Banrisul',
      'Daycoval',
      'Sofisa',
      'Mercantil do Brasil',
    ],
  },
  {
    categoria: 'Bancos Digitais',
    nomes: [
      'Nubank',
      'Inter',
      'C6 Bank',
      'Next (Bradesco)',
      'Pan',
      'Original',
      'Neon',
      'Agibank',
      'Banco Modal',
    ],
  },
  {
    categoria: 'Corretoras e Plataformas',
    nomes: [
      'XP Investimentos',
      'BTG Pactual Digital',
      'Rico Investimentos',
      'Clear Corretora',
      'Órama Investimentos',
      'Guide Investimentos',
      'Toro Investimentos',
      'Ágora Investimentos',
      'Easynvest (Nubank)',
      'Inter Invest',
      'Avenue Securities',
      'Nomad',
      'Passfolio',
      'Remessa Online',
      'Warren',
      'Vérios',
      'Gorila',
    ],
  },
  {
    categoria: 'Wealth Management Independentes',
    nomes: [
      'Julius Baer Brasil',
      'UBS Brasil',
      'Credit Suisse Brasil',
      'Morgan Stanley Brasil',
      'Goldman Sachs Brasil',
      'JP Morgan Brasil',
      'Merrill Lynch Brasil',
      'Mirabaud Brasil',
      'Pictet do Brasil',
      'EFG Brasil',
      'Lombard Odier Brasil',
      'Vontobel Brasil',
      'Geneva Swiss Bank',
      'Brasil Plural',
      'Banco BNP Paribas Brasil',
      'HSBC Brasil',
      'Citi Brasil',
    ],
  },
  {
    categoria: 'Multi-Family Offices e Gestoras',
    nomes: [
      'Vinci Partners',
      'Kinea Investimentos',
      'Pátria Investimentos',
      'Gávea Investimentos',
      'JGP Asset Management',
      'SPX Capital',
      'Kapitalo Investimentos',
      'Bahia Asset Management',
      'Verde Asset Management',
      'Truxt Investimentos',
      'Occam Brasil',
      'Giant Steps Capital',
      'Perfin Asset Management',
      'AZ Quest',
      'Ibiuna Investimentos',
      'Absolute Investimentos',
      'Legacy Capital',
      'Canvas Capital',
      'Vinland Capital',
      'Dynamo Administração de Recursos',
      'Portofino Multi Family Office',
      'SPS Capital',
      'Família Invest',
      'Impar Family Office',
      'DNA Capital',
      'NCF Wealth Management',
      'WHG (WM Holdings Group)',
      'Wealth Manager Brasil',
      'Opus Gestora',
      'Franklin Templeton Brasil',
      'BlackRock Brasil',
      'Schroders Brasil',
      'Fidelity International Brasil',
    ],
  },
]

// Flat list for filtering
const ALL_INSTITUICOES_FLAT = INSTITUICOES_BR.flatMap(g => g.nomes)

// ── Autocomplete combobox for institution name ────────────────────────────────

function InstituicaoCombobox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Keep query in sync when parent changes value programmatically
  useEffect(() => { setQuery(value) }, [value])

  // Reset active index when filtered list changes
  const filtered = query.trim().length === 0
    ? INSTITUICOES_BR
    : INSTITUICOES_BR.map(grupo => ({
        ...grupo,
        nomes: grupo.nomes.filter(n =>
          n.toLowerCase().includes(query.trim().toLowerCase())
        ),
      })).filter(g => g.nomes.length > 0)

  // Flat list for arrow-key index tracking
  const flatOptions = filtered.flatMap(g => g.nomes)
  const totalResults = flatOptions.length

  useEffect(() => { setActiveIndex(-1) }, [query])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        onChange(query)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, query, onChange])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function select(nome: string) {
    setQuery(nome)
    onChange(nome)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) { setOpen(true); return }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, totalResults - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && flatOptions[activeIndex]) {
        select(flatOptions[activeIndex])
      } else if (totalResults === 1) {
        select(flatOptions[0])
      } else {
        onChange(query)
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      onChange(query)
    }
  }

  // Build flat index counter across groups for data-idx assignment
  let flatIdx = -1

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Digite ou selecione a instituição…'}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white"
        autoComplete="off"
      />

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 italic">
              Nenhuma sugestão — o valor digitado será salvo como está
            </div>
          ) : (
            filtered.map(grupo => (
              <div key={grupo.categoria}>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 sticky top-0">
                  {grupo.categoria}
                </div>
                {grupo.nomes.map(nome => {
                  flatIdx++
                  const idx = flatIdx
                  const isActive = idx === activeIndex
                  const isSelected = nome === value
                  return (
                    <button
                      key={nome}
                      type="button"
                      data-idx={idx}
                      onMouseDown={e => { e.preventDefault(); select(nome) }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-olive-50 text-olive-900'
                          : isSelected
                          ? 'bg-amber-50 text-olive-800 font-medium'
                          : 'text-gray-700 hover:bg-amber-50'
                      }`}
                    >
                      {nome}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  ativos: AtivoFinanceiro[]
  flags: ReviewFlag[]
  clientId: string
  extratosAnexos: RecordAnexo[]
  instituicoes: InstituicaoFinanceira[]
  onChange: (items: AtivoFinanceiro[]) => void
  onExtratosChange: (anexos: RecordAnexo[]) => void
  onInstituicoesChange: (items: InstituicaoFinanceira[]) => void
  onReclassify?: (index: number, destino: DestinoReclassificacao) => void
}

// ── Tipo options & grouping ───────────────────────────────────────────────────

export const TIPO_OPTIONS = [
  'Ações (Bolsa de Valores)',
  'Fundo de Ações',
  'Fundo de Investimento',
  'Fundo / Instrumento Financeiro',
  'Título Público / Tesouro Direto',
  'CDB',
  'LCI / LCA',
  'Debênture / CRI / CRA',
  'Previdência Privada (PGBL)',
  'Conta Corrente / Poupança',
  'Conta Poupança',
  'FGTS',
  'Criptoativo',
  'Crédito / Direito',
  'Consórcio',
  'Aplicação Financeira',
] as const

// Ordered category groups — determines section rendering order
const TIPO_GROUPS: { label: string; tipos: string[]; icon: string }[] = [
  {
    label: 'Ações e Participações em Bolsa',
    icon: '📈',
    tipos: ['Ações (Bolsa de Valores)', 'Fundo de Ações'],
  },
  {
    label: 'Fundos de Investimento',
    icon: '🏦',
    tipos: ['Fundo de Investimento', 'Fundo / Instrumento Financeiro'],
  },
  {
    label: 'Renda Fixa',
    icon: '📄',
    tipos: ['Título Público / Tesouro Direto', 'CDB', 'LCI / LCA', 'Debênture / CRI / CRA'],
  },
  {
    label: 'Previdência',
    icon: '🔒',
    tipos: ['Previdência Privada (PGBL)'],
  },
  {
    label: 'Conta e Poupança',
    icon: '🏧',
    tipos: ['Conta Corrente / Poupança', 'Conta Poupança', 'FGTS'],
  },
  {
    label: 'Criptoativos',
    icon: '₿',
    tipos: ['Criptoativo'],
  },
  {
    label: 'Outros',
    icon: '📂',
    tipos: ['Crédito / Direito', 'Consórcio', 'Aplicação Financeira'],
  },
]

// ── Type badge colours ────────────────────────────────────────────────────────

const TIPO_COLOR: Record<string, string> = {
  'Ações (Bolsa de Valores)':          'bg-blue-50 text-blue-700',
  'Fundo de Investimento':             'bg-olive-100 text-olive-700',
  'Fundo / Instrumento Financeiro':    'bg-olive-100 text-olive-700',
  'Fundo de Ações':                    'bg-olive-100 text-olive-700',
  'Título Público / Tesouro Direto':   'bg-emerald-50 text-emerald-700',
  'Previdência Privada (PGBL)':        'bg-purple-50 text-purple-700',
  'Conta Corrente / Poupança':         'bg-gray-100 text-gray-600',
  'Conta Poupança':                    'bg-gray-100 text-gray-600',
  'FGTS':                              'bg-gray-100 text-gray-600',
  'CDB':                               'bg-sky-50 text-sky-700',
  'LCI / LCA':                         'bg-teal-50 text-teal-700',
  'Debênture / CRI / CRA':             'bg-orange-50 text-orange-700',
  'Criptoativo':                       'bg-yellow-50 text-yellow-700',
  'Crédito / Direito':                 'bg-red-50 text-red-700',
}

function tipoBadgeColor(tipo: string): string {
  return TIPO_COLOR[tipo] ?? 'bg-gray-100 text-gray-500'
}

// ── Single ativo row ──────────────────────────────────────────────────────────

function AtivoRow({
  ativo,
  originalIndex,
  rank,
  groupTotal,
  flags,
  instituicoes,
  onUpdate,
  onRemove,
  onReclassify,
}: {
  ativo: AtivoFinanceiro
  originalIndex: number
  rank: number
  groupTotal: number
  flags: ReviewFlag[]
  instituicoes: InstituicaoFinanceira[]
  onUpdate: (field: keyof AtivoFinanceiro, value: string | number | boolean) => void
  onRemove: () => void
  onReclassify?: (destino: DestinoReclassificacao) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const itemFlags = flags.filter(f => f.field.startsWith(`ativosFinanceiros[${originalIndex}]`))
  const barPct = groupTotal > 1 ? Math.max(12, Math.round(100 - (rank / (groupTotal - 1)) * 80)) : 100

  return (
    <div className="rounded-xl overflow-hidden border border-gray-100 bg-white">
      {/* Columns: rank | description | institution-select | value | expand */}
      <div className="grid grid-cols-[28px_1fr_180px_96px_28px] items-center gap-3 px-4 py-3">
        <div className="text-center text-xs font-mono text-gray-300 tabular-nums">
          {rank + 1}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-gray-800 truncate font-medium leading-snug">
            {ativo.descricao ? ativo.descricao.slice(0, 90) : ativo.tipo}
          </p>
        </div>
        {/* Institution dropdown — inline in collapsed row */}
        {(() => {
          const valid = instituicoes.filter(i => i.nome.trim().length > 0)
          return (
            <div className="min-w-0 overflow-hidden">
              {valid.length > 0 ? (
                <select
                  value={ativo.instituicao ?? ''}
                  onChange={e => onUpdate('instituicao', e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white truncate"
                >
                  <option value="">— Indefinida —</option>
                  {valid.map(inst => (
                    <option key={inst.nome} value={inst.nome}>{inst.nome}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-gray-300 italic">Indefinida</span>
              )}
            </div>
          )
        })()}
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatBRL(ativo.valorAproximado)}</p>
          <div className="mt-1 h-0.5 bg-gray-100 rounded-full overflow-hidden w-full">
            <div className="h-full bg-olive-400 rounded-full" style={{ width: `${barPct}%` }} />
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-gray-300 hover:text-gray-600 px-1 py-1"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {itemFlags.length > 0 && (
        <div className="px-4 pb-2 space-y-1">
          {itemFlags.map((f, fi) => (
            <div key={fi} className={`text-xs px-3 py-1.5 rounded-lg border ${flagClasses(f.severity)}`}>{f.message}</div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="border-t border-gray-100 bg-amber-50 px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Descrição completa</label>
              <input value={ativo.descricao ?? ''} onChange={e => onUpdate('descricao', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide">Tipo / Produto</label>
              <select
                value={ativo.tipo}
                onChange={e => onUpdate('tipo', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white"
              >
                {TIPO_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                {/* Keep current value if it's not in the list */}
                {!TIPO_OPTIONS.includes(ativo.tipo as typeof TIPO_OPTIONS[number]) && (
                  <option value={ativo.tipo}>{ativo.tipo}</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide">Instituição custodiante</label>
              {(() => {
                const valid = instituicoes.filter(i => i.nome.trim().length > 0)
                return valid.length > 0 ? (
                  <select
                    value={ativo.instituicao ?? ''}
                    onChange={e => onUpdate('instituicao', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white"
                  >
                    <option value="">— Indefinida —</option>
                    {valid.map(inst => (
                      <option key={inst.nome} value={inst.nome}>{inst.nome}</option>
                    ))}
                  </select>
                ) : (
                  <input value={ativo.instituicao ?? ''} onChange={e => onUpdate('instituicao', e.target.value)}
                    placeholder="— Indefinida —"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white" />
                )
              })()}
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide">CNPJ do fundo / emissora</label>
              <input value={ativo.cnpj ?? ''} onChange={e => onUpdate('cnpj', e.target.value)}
                placeholder="00.000.000/0001-00"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide">Valor declarado (R$)</label>
              <input type="number" value={ativo.valorAproximado} onChange={e => onUpdate('valorAproximado', parseFloat(e.target.value) || 0)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Mover para:</span>
              <select
                defaultValue=""
                onChange={e => {
                  const val = e.target.value as DestinoReclassificacao
                  if (val && onReclassify) { onReclassify(val); e.target.value = '' }
                }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-500 bg-white focus:outline-none focus:ring-1 focus:ring-olive-200"
              >
                <option value="">Selecione seção…</option>
                <option value="imovel">Imóveis</option>
                <option value="participacao">Participação Societária</option>
                <option value="credito">Crédito</option>
                <option value="outro_bem">Outros Bens</option>
              </select>
            </div>
            <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">Remover ativo</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Category group block ──────────────────────────────────────────────────────

function CategoryGroup({
  label,
  icon,
  items,
  totalGeral,
  flags,
  instituicoes,
  onUpdate,
  onRemove,
  onReclassify,
}: {
  label: string
  icon: string
  items: { ativo: AtivoFinanceiro; originalIndex: number }[]
  totalGeral: number
  flags: ReviewFlag[]
  instituicoes: InstituicaoFinanceira[]
  onUpdate: (originalIndex: number, field: keyof AtivoFinanceiro, value: string | number | boolean) => void
  onRemove: (originalIndex: number) => void
  onReclassify?: (originalIndex: number, destino: DestinoReclassificacao) => void
}) {
  const groupTotal = items.reduce((s, { ativo }) => s + ativo.valorAproximado, 0)
  const pct = totalGeral > 0 ? ((groupTotal / totalGeral) * 100).toFixed(1) : '0.0'

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
      {/* Group header */}
      <div className="bg-olive-900 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">{label}</h3>
          <span className="text-xs text-olive-200 ml-1">{items.length} {items.length === 1 ? 'ativo' : 'ativos'}</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-white tabular-nums">{formatBRL(groupTotal)}</p>
          <p className="text-xs text-olive-200">{pct}% do total</p>
        </div>
      </div>
      {/* Items */}
      <div className="bg-amber-50 px-4 py-3 space-y-2">
        {items.map(({ ativo, originalIndex }, rank) => (
          <AtivoRow
            key={originalIndex}
            ativo={ativo}
            originalIndex={originalIndex}
            rank={rank}
            groupTotal={items.length}
            flags={flags}
            instituicoes={instituicoes}
            onUpdate={(field, value) => onUpdate(originalIndex, field, value)}
            onRemove={() => onRemove(originalIndex)}
            onReclassify={onReclassify ? (d) => onReclassify(originalIndex, d) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

// ── Instituições Financeiras card ─────────────────────────────────────────────

// Granular ativo row inside an institution's composition panel
function ComposicaoRow({
  ativo,
  originalIndex,
  allInstituicoes,
  onReclassify,
}: {
  ativo: AtivoFinanceiro
  originalIndex: number
  allInstituicoes: InstituicaoFinanceira[]
  onReclassify: (originalIndex: number, instituicao: string) => void
}) {
  return (
    <div className="grid grid-cols-[1fr_120px_160px_96px] items-center gap-3 px-4 py-2 hover:bg-amber-100/60 transition-colors">
      <p className="text-xs text-gray-700 truncate font-medium">
        {ativo.descricao ? ativo.descricao.slice(0, 80) : ativo.tipo}
      </p>
      <span className={`text-xs px-1.5 py-0.5 rounded text-center truncate ${tipoBadgeColor(ativo.tipo)}`}>
        {ativo.tipo}
      </span>
      <select
        value={ativo.instituicao}
        onChange={e => onReclassify(originalIndex, e.target.value)}
        onClick={e => e.stopPropagation()}
        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-olive-200"
      >
        <option value="">— Não classificada —</option>
        {allInstituicoes.map(i => (
          <option key={i.nome} value={i.nome}>{i.nome}</option>
        ))}
      </select>
      <p className="text-xs font-semibold text-gray-800 tabular-nums text-right">
        {formatBRL(ativo.valorAproximado)}
      </p>
    </div>
  )
}

function ContactField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-olive-200 bg-white"
      />
    </div>
  )
}

function InstituicaoRow({
  inst,
  totalCustodiado,
  ativosNaInstituicao,
  allInstituicoes,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  onAtivoReclassify,
}: {
  inst: InstituicaoFinanceira
  totalCustodiado: number
  ativosNaInstituicao: { ativo: AtivoFinanceiro; originalIndex: number }[]
  allInstituicoes: InstituicaoFinanceira[]
  expanded: boolean
  onToggle: () => void
  onUpdate: (updated: InstituicaoFinanceira) => void
  onRemove: () => void
  onAtivoReclassify: (originalIndex: number, instituicao: string) => void
}) {
  const [showComposicao, setShowComposicao] = useState(false)
  const cp = inst.contatoPrimario ?? {}
  const cs = inst.contatoSecundario ?? {}

  function updateContato(tipo: 'contatoPrimario' | 'contatoSecundario', field: keyof ContatoInstituicao, value: string) {
    onUpdate({ ...inst, [tipo]: { ...(inst[tipo] ?? {}), [field]: value } })
  }

  return (
    <>
      {/* Columns: Institution | Contato primário | Sob custódia + composição toggle | Details toggle */}
      <div className="grid grid-cols-[1fr_200px_160px_32px] items-center gap-3 px-4 py-3 hover:bg-amber-100/60 transition-colors">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {inst.nome || <span className="text-gray-300 italic">Nova instituição</span>}
          </p>
        </div>
        <div className="min-w-0 space-y-0.5">
          {cp.nome && <p className="text-xs text-gray-600 truncate font-medium">{cp.nome}</p>}
          {cp.email && <p className="text-xs text-gray-500 truncate">{cp.email}</p>}
          {cp.telefone && <p className="text-xs text-gray-400 truncate">{cp.telefone}</p>}
          {!cp.nome && !cp.email && !cp.telefone && <p className="text-xs text-gray-300 italic">Contato não preenchido</p>}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-800 tabular-nums">{formatBRL(totalCustodiado)}</p>
          {ativosNaInstituicao.length > 0 ? (
            <button
              onClick={e => { e.stopPropagation(); setShowComposicao(s => !s) }}
              className="text-xs text-olive-600 hover:text-olive-900 mt-0.5"
            >
              {showComposicao ? '▲ ocultar' : `▼ ${ativosNaInstituicao.length} ${ativosNaInstituicao.length === 1 ? 'ativo' : 'ativos'}`}
            </button>
          ) : (
            <p className="text-xs text-gray-400">sob custódia</p>
          )}
        </div>
        <button onClick={onToggle} className="text-gray-300 hover:text-gray-600 text-xs px-1">
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Composition panel */}
      {showComposicao && ativosNaInstituicao.length > 0 && (
        <div className="border-t border-gray-100 bg-white">
          <div className="grid grid-cols-[1fr_120px_160px_96px] gap-3 px-4 py-1.5 border-b border-gray-50">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Ativo</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tipo</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Instituição</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Valor</span>
          </div>
          <div className="divide-y divide-gray-50">
            {ativosNaInstituicao.map(({ ativo, originalIndex }) => (
              <ComposicaoRow
                key={originalIndex}
                ativo={ativo}
                originalIndex={originalIndex}
                allInstituicoes={allInstituicoes}
                onReclassify={onAtivoReclassify}
              />
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-5 bg-white border-t border-gray-100 space-y-4 pt-4">
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nome da instituição</label>
            <div className="mt-1">
              <InstituicaoCombobox
                value={inst.nome}
                onChange={v => onUpdate({ ...inst, nome: v })}
                placeholder="Digite ou selecione — ex.: BTG Pactual, XP Investimentos"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contato primário</p>
            <div className="grid grid-cols-3 gap-3">
              <ContactField label="Nome" value={cp.nome ?? ''} onChange={v => updateContato('contatoPrimario', 'nome', v)} placeholder="Nome completo" />
              <ContactField label="E-mail" value={cp.email ?? ''} onChange={v => updateContato('contatoPrimario', 'email', v)} placeholder="email@instituicao.com.br" />
              <ContactField label="Telefone" value={cp.telefone ?? ''} onChange={v => updateContato('contatoPrimario', 'telefone', v)} placeholder="+55 (11) 9 0000-0000" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contato secundário</p>
            <div className="grid grid-cols-3 gap-3">
              <ContactField label="Nome" value={cs.nome ?? ''} onChange={v => updateContato('contatoSecundario', 'nome', v)} placeholder="Nome completo" />
              <ContactField label="E-mail" value={cs.email ?? ''} onChange={v => updateContato('contatoSecundario', 'email', v)} placeholder="email@instituicao.com.br" />
              <ContactField label="Telefone" value={cs.telefone ?? ''} onChange={v => updateContato('contatoSecundario', 'telefone', v)} placeholder="+55 (11) 9 0000-0000" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">Remover instituição</button>
          </div>
        </div>
      )}
    </>
  )
}

function InstituicoesCard({
  instituicoes,
  ativos,
  onChange,
  onAtivoUpdate,
}: {
  instituicoes: InstituicaoFinanceira[]
  ativos: AtivoFinanceiro[]
  onChange: (items: InstituicaoFinanceira[]) => void
  onAtivoUpdate: (originalIndex: number, instituicao: string) => void
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const totalGeral = ativos.reduce((s, a) => s + a.valorAproximado, 0)

  function ativosNaInstituicao(nome: string) {
    return ativos
      .map((a, i) => ({ ativo: a, originalIndex: i }))
      .filter(({ ativo }) => ativo.instituicao === nome)
  }

  function custodiado(nome: string): number {
    return ativosNaInstituicao(nome).reduce((s, { ativo }) => s + ativo.valorAproximado, 0)
  }

  function addInstituicao() {
    const newIndex = instituicoes.length
    onChange([...instituicoes, { nome: '' }])
    setExpandedIndex(newIndex)
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
      <div className="bg-olive-900 px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Instituições Financeiras Custodiantes</h3>
          <p className="text-xs text-olive-200 mt-0.5">
            {instituicoes.length > 0
              ? `${instituicoes.length} ${instituicoes.length === 1 ? 'instituição' : 'instituições'} · ${formatBRL(totalGeral)} sob custódia`
              : 'Detectadas automaticamente pelo IRPF · adicione os contatos'}
          </p>
        </div>
      </div>
      <div className="bg-amber-50">
        {instituicoes.length > 0 && (
          <>
            <div className="grid grid-cols-[1fr_200px_160px_32px] gap-3 px-4 py-2 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Instituição</span>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Contato primário</span>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Sob custódia</span>
              <div />
            </div>
            <div className="divide-y divide-gray-100">
              {instituicoes.map((inst, i) => (
                <InstituicaoRow
                  key={i}
                  inst={inst}
                  totalCustodiado={custodiado(inst.nome)}
                  ativosNaInstituicao={ativosNaInstituicao(inst.nome)}
                  allInstituicoes={instituicoes}
                  expanded={expandedIndex === i}
                  onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
                  onUpdate={updated => {
                    const next = [...instituicoes]
                    next[i] = updated
                    onChange(next)
                  }}
                  onRemove={() => {
                    onChange(instituicoes.filter((_, j) => j !== i))
                    setExpandedIndex(null)
                  }}
                  onAtivoReclassify={onAtivoUpdate}
                />
              ))}
            </div>
          </>
        )}
        {/* Indefinida summary row */}
        {(() => {
          const indefinidos = ativos.filter(a => !a.instituicao)
          if (indefinidos.length === 0) return null
          const total = indefinidos.reduce((s, a) => s + a.valorAproximado, 0)
          return (
            <div className="grid grid-cols-[1fr_200px_160px_32px] gap-3 items-center px-4 py-2.5 border-t border-dashed border-amber-300 bg-amber-100/60">
              <span className="text-xs text-amber-700 italic">Indefinida</span>
              <span className="text-xs text-amber-600 italic">{indefinidos.length} ativo{indefinidos.length !== 1 ? 's' : ''} sem instituição</span>
              <span className="text-xs font-semibold text-amber-700 text-right">{formatBRL(total)}</span>
              <div />
            </div>
          )
        })()}
        <div className="px-5 py-3">
          <button
            onClick={addInstituicao}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            + Adicionar instituição
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Bank statement upload ─────────────────────────────────────────────────────

function ExtratosUpload({
  clientId,
  anexos,
  onChange,
}: {
  clientId: string
  anexos: RecordAnexo[]
  onChange: (a: RecordAnexo[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('categoria', 'extrato_financeiro')
      const res = await fetch('/api/documentos', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error || 'Erro no upload')
        return
      }
      const { fileName, storagePath } = await res.json()
      onChange([...anexos, {
        nome: file.name, fileName, storagePath,
        uploadedAt: new Date().toISOString(), status: 'enviado',
      }])
    } catch { setError('Falha na conexão') }
    finally { setUploading(false) }
  }

  async function download(a: RecordAnexo) {
    if (!a.storagePath) return
    const res = await fetch(`/api/documentos/signed-url?path=${encodeURIComponent(a.storagePath)}`)
    if (!res.ok) return
    const { url } = await res.json()
    window.open(url, '_blank')
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
      <div className="bg-olive-900 px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Extratos Financeiros</h3>
          <p className="text-xs text-olive-200 mt-0.5">Extratos bancários e de corretoras · PDF, XLS, OFX</p>
        </div>
        <span className="text-xs font-semibold text-white bg-white/10 px-3 py-1 rounded-full">
          {anexos.filter(a => a.status === 'enviado').length} enviado(s)
        </span>
      </div>
      <div className="bg-amber-50 px-5 py-4 space-y-3">
        {anexos.length > 0 && (
          <div className="divide-y divide-gray-100">
            {anexos.map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <span className="text-gray-300 text-xs flex-shrink-0">📎</span>
                <span className="text-sm text-gray-700 flex-1 truncate">{a.nome || a.fileName}</span>
                {a.storagePath && (
                  <button onClick={() => download(a)} className="flex-shrink-0 text-xs text-olive-700 hover:text-olive-900 underline">Baixar</button>
                )}
                <button onClick={() => onChange(anexos.filter((_, j) => j !== i))} className="flex-shrink-0 text-xs text-red-300 hover:text-red-500">✕</button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <input ref={inputRef} type="file" accept=".pdf,.xls,.xlsx,.csv,.ofx" multiple className="hidden"
          onChange={async e => {
            for (const f of Array.from(e.target.files ?? [])) await handleFile(f)
            e.target.value = ''
          }} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-olive-300 hover:text-olive-700 transition-colors disabled:opacity-50">
          {uploading ? 'Enviando…' : '+ Adicionar extrato (PDF, XLS, OFX)'}
        </button>
        <p className="text-xs text-gray-300 text-center">
          Em versões futuras, extratos serão utilizados para reconciliação automática dos saldos
        </p>
      </div>
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

export function AtivosSection({ ativos, flags, clientId, extratosAnexos, instituicoes, onChange, onExtratosChange, onInstituicoesChange, onReclassify }: Props) {
  const totalGeral = ativos.reduce((s, a) => s + a.valorAproximado, 0)

  function updateAtivo(originalIndex: number, field: keyof AtivoFinanceiro, value: string | number | boolean) {
    const updated = [...ativos]
    updated[originalIndex] = { ...updated[originalIndex], [field]: value }
    onChange(updated)
  }

  function removeAtivo(originalIndex: number) {
    onChange(ativos.filter((_, i) => i !== originalIndex))
  }

  function addAtivo() {
    onChange([...ativos, { instituicao: '', tipo: 'Aplicação Financeira', valorAproximado: 0, source: 'manual', needsReview: true }])
  }

  const sectionFlags = flags.filter(f => f.section === 'ativosFinanceiros' && !f.field.includes('['))

  // Build groups: assign each ativo to its group bucket, sort within group by value desc
  const groupedItems = TIPO_GROUPS.map(group => {
    const items = ativos
      .map((a, i) => ({ ativo: a, originalIndex: i }))
      .filter(({ ativo }) => group.tipos.includes(ativo.tipo))
      .sort((a, b) => b.ativo.valorAproximado - a.ativo.valorAproximado)
    return { ...group, items }
  }).filter(g => g.items.length > 0)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Ativos Financeiros</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {ativos.length} {ativos.length === 1 ? 'ativo' : 'ativos'} · total:{' '}
          <strong className="text-gray-700">{formatBRL(totalGeral)}</strong>
        </p>
      </div>

      {sectionFlags.map((f, i) => (
        <div key={i} className={`text-xs px-3 py-2 rounded-lg border ${flagClasses(f.severity)}`}>{f.message}</div>
      ))}

      <InstituicoesCard
        instituicoes={instituicoes}
        ativos={ativos}
        onChange={onInstituicoesChange}
        onAtivoUpdate={(originalIndex, instituicao) => updateAtivo(originalIndex, 'instituicao', instituicao)}
      />

      {groupedItems.length > 0 ? (
        <div className="space-y-4">
          {groupedItems.map(group => (
            <CategoryGroup
              key={group.label}
              label={group.label}
              icon={group.icon}
              items={group.items}
              totalGeral={totalGeral}
              flags={flags}
              instituicoes={instituicoes}
              onUpdate={updateAtivo}
              onRemove={removeAtivo}
              onReclassify={onReclassify}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-gray-400">Nenhum ativo financeiro registrado.</div>
      )}

      <button onClick={addAtivo}
        className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
        + Adicionar ativo financeiro
      </button>

      <ExtratosUpload clientId={clientId} anexos={extratosAnexos} onChange={onExtratosChange} />
    </div>
  )
}
