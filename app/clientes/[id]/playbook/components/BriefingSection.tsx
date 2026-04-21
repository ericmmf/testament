'use client'

import { useState } from 'react'
import { BriefingCliente } from '@/lib/types/playbook'

interface Props {
  briefing: BriefingCliente
  onChange: (b: BriefingCliente) => void
}

function Textarea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none bg-white"
    />
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
      />
    </div>
  )
}

// ── Collapsible card — same expand pattern as DadosPessoais ──────────────────

function BriefingCard({
  icon,
  title,
  hint,
  preview,
  children,
}: {
  icon: string
  title: string
  hint?: string
  preview: React.ReactNode
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
      {/* Header — always visible, olive-900 */}
      <div className="bg-olive-900 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-sm flex-shrink-0">{icon}</div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {hint && <p className="text-xs text-olive-200 mt-0.5">{hint}</p>}
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-shrink-0 text-white/60 hover:text-white text-xs px-2 py-1 ml-3"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Collapsed — beige read-only preview */}
      {!expanded && (
        <div className="bg-amber-50 px-5 py-4">
          {preview}
        </div>
      )}

      {/* Expanded — white editable form */}
      {expanded && (
        <div className="bg-white px-5 py-5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Preview helpers ────────────────────────────────────────────────────────────

function TextPreview({ text, placeholder }: { text?: string; placeholder: string }) {
  if (!text?.trim()) return <p className="text-xs text-gray-300 italic">{placeholder}</p>
  const truncated = text.length > 200 ? text.slice(0, 197) + '…' : text
  return <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{truncated}</p>
}

// ── Main section ──────────────────────────────────────────────────────────────

export function BriefingSection({ briefing, onChange }: Props) {
  const conselheiros = briefing.conselheirosConfianca ?? []

  function setConselheiro(i: number, field: string, value: string) {
    const updated = [...conselheiros]
    updated[i] = { ...updated[i], [field]: value }
    onChange({ ...briefing, conselheirosConfianca: updated })
  }

  function addConselheiro() {
    onChange({ ...briefing, conselheirosConfianca: [...conselheiros, { nome: '', papel: '' }] })
  }

  function removeConselheiro(i: number) {
    onChange({ ...briefing, conselheirosConfianca: conselheiros.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-5">

      <div>
        <h2 className="text-base font-semibold text-gray-900">Briefing do Cliente</h2>
        <p className="text-sm text-gray-400 mt-1">
          Capture as intenções e diretrizes do cliente. Oriente a comparação entre vontade declarada e realidade legal.
        </p>
      </div>

      {/* Intenções de partilha */}
      <BriefingCard
        icon="📋"
        title="Intenções de Partilha"
        hint="Quem fica com o quê"
        preview={<TextPreview text={briefing.intencoesPartilha} placeholder="Não preenchido — clique ▼ para editar" />}
      >
        <p className="text-xs text-gray-400 mb-3">
          Descreva as intenções do cliente sobre a distribuição do patrimônio entre herdeiros e beneficiários.
        </p>
        <Textarea
          value={briefing.intencoesPartilha ?? ''}
          onChange={v => onChange({ ...briefing, intencoesPartilha: v })}
          rows={5}
          placeholder="Ex.: A residência principal deve permanecer com a cônjuge durante sua vida..."
        />
      </BriefingCard>

      {/* Tutores e curadores */}
      <BriefingCard
        icon="🛡️"
        title="Tutores e Curadores Sugeridos"
        hint="Indicações para menores e incapazes"
        preview={<TextPreview text={briefing.tutoresCuradores} placeholder="Não preenchido — clique ▼ para editar" />}
      >
        <p className="text-xs text-gray-400 mb-3">
          Identifique quem o cliente deseja como tutor ou curador. Inclua grau de parentesco e contato.
        </p>
        <Textarea
          value={briefing.tutoresCuradores ?? ''}
          onChange={v => onChange({ ...briefing, tutoresCuradores: v })}
          rows={4}
          placeholder="Ex.: Para os filhos menores, indicar como tutora a avó paterna..."
        />
      </BriefingCard>

      {/* Conselheiros de confiança */}
      <BriefingCard
        icon="🤝"
        title="Conselheiros e Pessoas-Chave"
        hint={`${conselheiros.length} ${conselheiros.length === 1 ? 'contato' : 'contatos'} cadastrados`}
        preview={
          conselheiros.length > 0 ? (
            <div className="space-y-1">
              {conselheiros.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-olive-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 font-medium">{c.nome || 'Sem nome'}</span>
                  {c.papel && <span className="text-xs text-gray-400">· {c.papel}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-300 italic">Nenhum contato — clique ▼ para adicionar</p>
          )
        }
      >
        <p className="text-xs text-gray-400 mb-4">
          Advogados, contadores, gestores, familiares de referência a acionar no processo.
        </p>
        <div className="space-y-4">
          {conselheiros.map((c, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Contato {i + 1}</span>
                <button onClick={() => removeConselheiro(i)} className="text-xs text-red-400 hover:text-red-600">remover</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome" value={c.nome} onChange={v => setConselheiro(i, 'nome', v)} placeholder="Nome completo" />
                <Field label="Papel / Função" value={c.papel} onChange={v => setConselheiro(i, 'papel', v)} placeholder="Ex.: Advogado, Contador" />
                <Field label="Telefone" value={c.telefone ?? ''} onChange={v => setConselheiro(i, 'telefone', v)} placeholder="+55 11 99999-9999" type="tel" />
                <Field label="Email" value={c.email ?? ''} onChange={v => setConselheiro(i, 'email', v)} placeholder="email@exemplo.com" type="email" />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addConselheiro}
          className="mt-4 w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          + Adicionar pessoa-chave
        </button>
      </BriefingCard>

      {/* Diretrizes gerais */}
      <BriefingCard
        icon="💬"
        title="Diretrizes e Mensagens Gerais"
        hint="Orientações ao inventariante e herdeiros"
        preview={<TextPreview text={briefing.diretrizes} placeholder="Não preenchido — clique ▼ para editar" />}
      >
        <p className="text-xs text-gray-400 mb-3">
          Instruções de conduta, valores a preservar, orientações sobre gestão de ativos, mensagens pessoais.
        </p>
        <Textarea
          value={briefing.diretrizes ?? ''}
          onChange={v => onChange({ ...briefing, diretrizes: v })}
          rows={6}
          placeholder="Ex.: Manter a empresa familiar unida por pelo menos 5 anos após o falecimento..."
        />
      </BriefingCard>

    </div>
  )
}
