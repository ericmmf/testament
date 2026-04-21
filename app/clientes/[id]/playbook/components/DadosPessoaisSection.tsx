'use client'

import { useState } from 'react'
import {
  PlaybookData,
  Familiar,
  RelacaoImportante,
  ContatoEssencial,
  UrgenciaContato,
  DocumentoDropbox,
  CertidaoCasamento,
} from '@/lib/types/playbook'
import { resolveRelacao, initials } from './utils'

type DadosPessoais = PlaybookData['dadosPessoais']

interface PatrimonioTotals {
  imoveis: number
  ativos: number
  participacoes: number
  creditos: number
  outros?: number           // Grupo 02 + 99 — não renderizados como seções
  totalIRPFDeclarado?: number  // Do Resumo da Declaração — para reconciliação
}

interface Props {
  data: DadosPessoais
  onChange: (d: DadosPessoais) => void
  patrimonio?: PatrimonioTotals
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
      <input
        type="text"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
      />
    </div>
  )
}

function formatCPF(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length !== 11) return raw ?? ''
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ── Collapsible card shell ────────────────────────────────────────────────────

function CollapsibleCard({
  children,
  header,
  preview,
}: {
  children: React.ReactNode
  header: React.ReactNode
  preview: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
      <div className="bg-olive-900 flex items-stretch">
        <div className="flex-1 px-5 py-4">{header}</div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="px-4 text-white/60 hover:text-white text-xs border-l border-white/10 flex-shrink-0"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      {!expanded && <div className="bg-amber-50 px-5 py-4">{preview}</div>}
      {expanded && <div className="bg-white px-5 py-5">{children}</div>}
    </div>
  )
}

// ── Person table helpers ──────────────────────────────────────────────────────

function PersonEditForm<T extends { nome: string; relacao: string; cpf?: string; email?: string; telefone?: string; observacao?: string }>({
  person,
  onUpdate,
  showObservacao,
}: {
  person: T
  onUpdate: (field: keyof T, value: string) => void
  showObservacao?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-3 pb-1">
      <Field label="Nome completo" value={person.nome} onChange={v => onUpdate('nome' as keyof T, v)} />
      <Field label="Relação" value={person.relacao} onChange={v => onUpdate('relacao' as keyof T, v)} placeholder="Ex.: Filha, Cônjuge, Sócio" />
      <Field label="CPF" value={person.cpf ?? ''} onChange={v => onUpdate('cpf' as keyof T, v)} placeholder="000.000.000-00" />
      <Field label="Email" value={person.email ?? ''} onChange={v => onUpdate('email' as keyof T, v)} placeholder="email@exemplo.com" />
      <div className="col-span-2">
        <Field label="Telefone" value={person.telefone ?? ''} onChange={v => onUpdate('telefone' as keyof T, v)} placeholder="+55 (11) 9 0000-0000" />
      </div>
      {showObservacao && (
        <div className="col-span-2">
          <Field label="Observação" value={(person as RelacaoImportante).observacao ?? ''} onChange={v => onUpdate('observacao' as keyof T, v)} placeholder="Contexto relevante" />
        </div>
      )}
    </div>
  )
}

function PersonTableRow<T extends { nome: string; relacao: string; cpf?: string; email?: string; telefone?: string; observacao?: string }>({
  person,
  index,
  label,
  onUpdate,
  onRemove,
  showObservacao,
}: {
  person: T
  index: number
  label: string
  onUpdate: (field: keyof T, value: string) => void
  onRemove: () => void
  showObservacao?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div className="grid grid-cols-[28px_1fr_160px_120px_32px] items-center gap-3 px-4 py-2.5 hover:bg-amber-100/60 transition-colors">
        <div className="w-7 h-7 rounded-full bg-olive-100 flex items-center justify-center text-xs font-semibold text-olive-800 flex-shrink-0">
          {initials(person.nome) || '?'}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{person.nome || label}</p>
          {person.cpf && <p className="text-xs text-gray-400 font-mono truncate">{formatCPF(person.cpf)}</p>}
        </div>
        <div className="min-w-0">
          {person.email && <p className="text-xs text-gray-500 truncate">{person.email}</p>}
          {person.telefone && <p className="text-xs text-gray-400 truncate">{person.telefone}</p>}
          {!person.email && !person.telefone && <span className="text-xs text-gray-300">—</span>}
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-olive-100 text-olive-700 font-medium truncate text-center">
          {resolveRelacao(person.relacao) || '—'}
        </span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-300 hover:text-gray-600 text-xs px-1"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 bg-white border-t border-gray-100">
          <PersonEditForm person={person} onUpdate={onUpdate} showObservacao={showObservacao} />
          <div className="flex justify-end mt-2">
            <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">Remover</button>
          </div>
        </div>
      )}
    </>
  )
}

function TableHeader() {
  return (
    <div className="grid grid-cols-[28px_1fr_160px_120px_32px] items-center gap-3 px-4 py-2 border-b border-gray-100">
      <div />
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nome / CPF</span>
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Contato</span>
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center">Relação</span>
      <div />
    </div>
  )
}

// ── Urgência icons ────────────────────────────────────────────────────────────

const URGENCIA_ICON: Record<UrgenciaContato, string> = {
  urgente: '🔴',
  importante: '🟡',
  normal: '🟢',
  condicional: '⚪',
}

const URGENCIA_LABEL: Record<UrgenciaContato, string> = {
  urgente: 'Urgente',
  importante: 'Importante',
  normal: 'Normal',
  condicional: 'Condicional',
}

// ── ContatoEssencial row ──────────────────────────────────────────────────────

function ContatoEssencialRow({
  contato,
  index,
  onUpdate,
  onRemove,
}: {
  contato: ContatoEssencial
  index: number
  onUpdate: (field: keyof ContatoEssencial, value: string) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div className="grid grid-cols-[32px_32px_1fr_100px_32px] items-center gap-3 px-4 py-2.5 hover:bg-amber-100/60 transition-colors">
        {/* Prioridade number */}
        <span className="text-xs font-semibold text-gray-400 text-center">{contato.prioridade}</span>
        {/* Urgência icon */}
        <span className="text-base text-center">{URGENCIA_ICON[contato.urgencia] ?? '⚪'}</span>
        {/* Nome + função */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{contato.nome || `Contato ${index + 1}`}</p>
          {contato.funcao && <p className="text-xs text-gray-400 truncate">{contato.funcao}</p>}
        </div>
        {/* Contato (phone/email truncated) */}
        <span className="text-xs text-gray-400 truncate hidden sm:block">{contato.contato || '—'}</span>
        {/* Expand */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-300 hover:text-gray-600 text-xs px-1"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 bg-white border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-2 gap-3 pt-3">
            <Field label="Prioridade" value={contato.prioridade} onChange={v => onUpdate('prioridade', v)} placeholder="1, 2, 3…" />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Urgência</label>
              <select
                value={contato.urgencia}
                onChange={e => onUpdate('urgencia', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
              >
                {(Object.keys(URGENCIA_LABEL) as UrgenciaContato[]).map(u => (
                  <option key={u} value={u}>{URGENCIA_ICON[u]} {URGENCIA_LABEL[u]}</option>
                ))}
              </select>
            </div>
            <Field label="Nome" value={contato.nome} onChange={v => onUpdate('nome', v)} placeholder="Nome completo" />
            <Field label="Função / Papel" value={contato.funcao} onChange={v => onUpdate('funcao', v)} placeholder="Advogado, Contador, Gestor…" />
            <div className="col-span-2">
              <Field label="Contato (telefone, email, endereço)" value={contato.contato ?? ''} onChange={v => onUpdate('contato', v)} placeholder="+55 11 99999-9999" />
            </div>
            <div className="col-span-2">
              <Field label="Observação" value={contato.observacao ?? ''} onChange={v => onUpdate('observacao', v)} placeholder="Acionado se / instrução especial" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">Remover</button>
          </div>
        </div>
      )}
    </>
  )
}

// ── DocumentoDropbox row ──────────────────────────────────────────────────────

function DocumentoDropboxRow({
  doc,
  index,
  onUpdate,
  onRemove,
}: {
  doc: DocumentoDropbox
  index: number
  onUpdate: (field: keyof DocumentoDropbox, value: string) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div className="grid grid-cols-[1fr_160px_32px] items-center gap-3 px-4 py-2.5 hover:bg-amber-100/60 transition-colors">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{doc.descricao || `Documento ${index + 1}`}</p>
          <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{doc.caminho || '—'}</p>
        </div>
        <div className="min-w-0">
          {doc.responsavel
            ? <p className="text-xs text-gray-500 truncate">{doc.responsavel}</p>
            : <span className="text-xs text-gray-300">—</span>
          }
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-300 hover:text-gray-600 text-xs px-1 flex-shrink-0"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 bg-white border-t border-gray-100 space-y-3 pt-3">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Descrição" value={doc.descricao} onChange={v => onUpdate('descricao', v)} placeholder="Ex.: Testamento, Apólices de Seguro" />
            <Field label="Caminho / Localização" value={doc.caminho} onChange={v => onUpdate('caminho', v)} placeholder="NCM Dropbox → Eric Fonseca → …" />
            <Field label="Responsável / Contato" value={doc.responsavel ?? ''} onChange={v => onUpdate('responsavel', v)} placeholder="Nome, e-mail ou telefone do responsável" />
            <Field label="Conteúdo" value={doc.conteudo ?? ''} onChange={v => onUpdate('conteudo', v)} placeholder="O que está nesta pasta" />
            <Field label="Como acessar" value={doc.acesso ?? ''} onChange={v => onUpdate('acesso', v)} placeholder="Contatar fulano / senha no cofre" />
          </div>
          <div className="flex justify-end">
            <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">Remover</button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DadosPessoaisSection({ data, onChange, patrimonio }: Props) {
  const relacoesImportantes = data.relacoesImportantes ?? []
  const contatosEssenciais = data.contatosEssenciais ?? []
  const documentosDropbox = data.documentosDropbox ?? []
  const certidaoCasamento = data.certidaoCasamento ?? {}

  // ── Familiares handlers ──────────────────────────────────────────────────────
  function updateFamiliar(i: number, field: keyof Familiar, value: string) {
    const updated = [...data.familiares]
    updated[i] = { ...updated[i], [field]: value }
    onChange({ ...data, familiares: updated })
  }
  function removeFamiliar(i: number) {
    onChange({ ...data, familiares: data.familiares.filter((_, idx) => idx !== i) })
  }
  function addFamiliar() {
    onChange({ ...data, familiares: [...data.familiares, { nome: '', relacao: '', cpf: '', email: '', telefone: '' }] })
  }

  // ── Relações importantes handlers ────────────────────────────────────────────
  function addRelacao() {
    onChange({ ...data, relacoesImportantes: [...relacoesImportantes, { nome: '', relacao: '' }] })
  }
  function updateRelacao(i: number, field: keyof RelacaoImportante, value: string) {
    const updated = [...relacoesImportantes]
    updated[i] = { ...updated[i], [field]: value }
    onChange({ ...data, relacoesImportantes: updated })
  }
  function removeRelacao(i: number) {
    onChange({ ...data, relacoesImportantes: relacoesImportantes.filter((_, idx) => idx !== i) })
  }

  // ── Certidão de Casamento handlers ───────────────────────────────────────────
  function updateCertidao(field: keyof CertidaoCasamento, value: string) {
    onChange({ ...data, certidaoCasamento: { ...certidaoCasamento, [field]: value } })
  }

  // ── Contatos Essenciais handlers ─────────────────────────────────────────────
  function addContatoEssencial() {
    const next: ContatoEssencial = {
      prioridade: String(contatosEssenciais.length + 1),
      urgencia: 'normal',
      nome: '',
      funcao: '',
    }
    onChange({ ...data, contatosEssenciais: [...contatosEssenciais, next] })
  }
  function updateContatoEssencial(i: number, field: keyof ContatoEssencial, value: string) {
    const updated = [...contatosEssenciais]
    updated[i] = { ...updated[i], [field]: value }
    onChange({ ...data, contatosEssenciais: updated })
  }
  function removeContatoEssencial(i: number) {
    onChange({ ...data, contatosEssenciais: contatosEssenciais.filter((_, idx) => idx !== i) })
  }

  // ── Documentos Dropbox handlers ──────────────────────────────────────────────
  function addDocumentoDropbox() {
    onChange({ ...data, documentosDropbox: [...documentosDropbox, { descricao: '', caminho: '' }] })
  }
  function updateDocumentoDropbox(i: number, field: keyof DocumentoDropbox, value: string) {
    const updated = [...documentosDropbox]
    updated[i] = { ...updated[i], [field]: value }
    onChange({ ...data, documentosDropbox: updated })
  }
  function removeDocumentoDropbox(i: number) {
    onChange({ ...data, documentosDropbox: documentosDropbox.filter((_, idx) => idx !== i) })
  }

  const totalPatrimonio = patrimonio
    ? patrimonio.imoveis + patrimonio.ativos + patrimonio.participacoes + patrimonio.creditos + (patrimonio.outros ?? 0)
    : 0
  const totalDeclarado = patrimonio?.totalIRPFDeclarado
  const reconcGap = totalDeclarado !== undefined && totalDeclarado > 0
    ? Math.abs(totalPatrimonio - totalDeclarado)
    : 0
  const reconcPct = totalDeclarado && totalDeclarado > 0
    ? (reconcGap / totalDeclarado) * 100
    : 0

  // Backward-compat: derive email/telefone from contatos[] if direct fields absent
  const emailValue = data.email ?? data.contatos?.find(c => c.tipo?.toLowerCase().includes('email'))?.valor ?? ''
  const telefoneValue = data.telefone ?? data.contatos?.find(c => c.tipo?.toLowerCase().includes('telefon'))?.valor ?? ''

  return (
    <div className="space-y-5">

      {/* Titular — merged identity + contacts card */}
      <CollapsibleCard
        header={
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
              {initials(data.nome) || '?'}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white">{data.nome || '—'}</h2>
              <p className="text-xs font-mono text-olive-200 mt-0.5">{formatCPF(data.cpf)}</p>
            </div>
          </div>
        }
        preview={
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm text-gray-600">
            {data.dataNascimento && <p className="text-xs">Nascimento: <span className="font-medium">{data.dataNascimento}</span></p>}
            {data.cidadanias && <p className="text-xs text-gray-500">{data.cidadanias}</p>}
            {emailValue && <p className="text-xs text-gray-500 truncate">{emailValue}</p>}
            {telefoneValue && <p className="text-xs text-gray-500">{telefoneValue}</p>}
            {data.ocupacao && <p className="text-xs text-gray-400 col-span-2">{data.ocupacao}</p>}
            {data.endereco && <p className="text-xs text-gray-400 truncate col-span-2">{data.endereco}</p>}
            {!data.dataNascimento && !emailValue && !telefoneValue && (
              <p className="text-xs text-gray-300 italic col-span-2">Clique ▼ para editar dados de identificação</p>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome completo" value={data.nome} onChange={v => onChange({ ...data, nome: v })} />
          <Field label="CPF" value={data.cpf} onChange={v => onChange({ ...data, cpf: v })} placeholder="000.000.000-00" />
          <Field label="Data de nascimento" value={data.dataNascimento ?? ''} onChange={v => onChange({ ...data, dataNascimento: v })} placeholder="DD/MM/AAAA" />
          <Field label="Cidadanias" value={data.cidadanias ?? ''} onChange={v => onChange({ ...data, cidadanias: v })} placeholder="Ex.: Brasileira e Portuguesa" />
          <Field label="E-mail principal" value={emailValue} onChange={v => onChange({ ...data, email: v })} placeholder="email@dominio.com" />
          <Field label="Telefone" value={telefoneValue} onChange={v => onChange({ ...data, telefone: v })} placeholder="+55 (11) 9 0000-0000" />
          <div className="col-span-2">
            <Field label="Ocupação declarada" value={data.ocupacao ?? ''} onChange={v => onChange({ ...data, ocupacao: v })} placeholder="Ex.: Dirigente, Presidente e Diretor de Empresa" />
          </div>
          <div className="col-span-2">
            <Field label="Endereço residencial" value={data.endereco ?? ''} onChange={v => onChange({ ...data, endereco: v })} />
          </div>
        </div>
      </CollapsibleCard>

      {/* Dependentes / familiares */}
      <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
        <div className="bg-olive-900 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Dependentes e Familiares</h3>
          <p className="text-xs text-olive-200 mt-0.5">Conforme declarados no IRPF · clique ▼ para editar</p>
        </div>
        <div className="bg-amber-50">
          {data.familiares.length > 0 && (
            <>
              <TableHeader />
              <div className="divide-y divide-gray-100">
                {data.familiares.map((f, i) => (
                  <PersonTableRow
                    key={i}
                    person={f}
                    index={i}
                    label={`Dependente ${i + 1}`}
                    onUpdate={(field, value) => updateFamiliar(i, field as keyof Familiar, value)}
                    onRemove={() => removeFamiliar(i)}
                    showObservacao={false}
                  />
                ))}
              </div>
            </>
          )}
          <div className="px-5 py-3">
            <button
              onClick={addFamiliar}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
            >
              + Adicionar dependente
            </button>
          </div>
        </div>
      </div>

      {/* Relações importantes */}
      <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
        <div className="bg-olive-900 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Relações Importantes</h3>
          <p className="text-xs text-olive-200 mt-0.5">Além dos dependentes fiscais · clique ▼ para editar</p>
        </div>
        <div className="bg-amber-50">
          <p className="text-xs text-gray-400 px-5 pt-4">
            Outras pessoas relevantes: sócios familiares, cônjuge em separação de bens, herdeiros de outro relacionamento, etc.
          </p>
          {relacoesImportantes.length > 0 && (
            <>
              <TableHeader />
              <div className="divide-y divide-gray-100">
                {relacoesImportantes.map((r, i) => (
                  <PersonTableRow
                    key={i}
                    person={r}
                    index={i}
                    label={`Relação ${i + 1}`}
                    onUpdate={(field, value) => updateRelacao(i, field as keyof RelacaoImportante, value)}
                    onRemove={() => removeRelacao(i)}
                    showObservacao={true}
                  />
                ))}
              </div>
            </>
          )}
          <div className="px-5 py-3">
            <button
              onClick={addRelacao}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
            >
              + Adicionar relação importante
            </button>
          </div>
        </div>
      </div>

      {/* Certidão de Casamento */}
      <CollapsibleCard
        header={
          <div>
            <h3 className="text-sm font-semibold text-white">Certidão de Casamento</h3>
              <p className="text-xs text-olive-200 mt-0.5">
                {certidaoCasamento.regimeBens
                  ? `${certidaoCasamento.regimeBens}${certidaoCasamento.data ? ' · ' + certidaoCasamento.data : ''}`
                  : 'Regime e data do casamento'}
              </p>
          </div>
        }
        preview={
          <div className="space-y-1 text-sm text-gray-600">
            {certidaoCasamento.regimeBens && (
              <p>Regime: <span className="font-medium">{certidaoCasamento.regimeBens}</span></p>
            )}
            {certidaoCasamento.implicacaoSuccessoria && (
              <p className="text-xs text-gray-500">{certidaoCasamento.implicacaoSuccessoria}</p>
            )}
            {certidaoCasamento.nomeConjugeApos && (
              <p className="text-xs text-gray-400">Cônjuge: {certidaoCasamento.nomeConjugeApos}</p>
            )}
            {!certidaoCasamento.regimeBens && !certidaoCasamento.nomeConjugeApos && (
              <p className="text-xs text-gray-300 italic">Não preenchido — clique ▼ para editar</p>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data do casamento" value={certidaoCasamento.data ?? ''} onChange={v => updateCertidao('data', v)} placeholder="DD/MM/AAAA" />
          <Field label="Matrícula" value={certidaoCasamento.matricula ?? ''} onChange={v => updateCertidao('matricula', v)} placeholder="Nº da certidão" />
          <Field label="Cartório" value={certidaoCasamento.cartorio ?? ''} onChange={v => updateCertidao('cartorio', v)} placeholder="Nome e cidade do cartório" />
          <Field label="Regime de bens" value={certidaoCasamento.regimeBens ?? ''} onChange={v => updateCertidao('regimeBens', v)} placeholder="Ex.: Separação Total" />
          <Field label="Nome cônjuge (antes)" value={certidaoCasamento.nomeConjugeAntes ?? ''} onChange={v => updateCertidao('nomeConjugeAntes', v)} placeholder="Nome de solteiro(a)" />
          <Field label="Nome cônjuge (após)" value={certidaoCasamento.nomeConjugeApos ?? ''} onChange={v => updateCertidao('nomeConjugeApos', v)} placeholder="Nome após o casamento" />
          <div className="col-span-2">
            <Field label="Implicação sucessória" value={certidaoCasamento.implicacaoSuccessoria ?? ''} onChange={v => updateCertidao('implicacaoSuccessoria', v)} placeholder="Ex.: Cônjuge não é herdeiro(a) necessário(a) pelo regime adotado" />
          </div>
        </div>
      </CollapsibleCard>

      {/* Visão geral do patrimônio */}
      {patrimonio && totalPatrimonio > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
          <div className="bg-olive-900 px-5 py-4">
            <h3 className="text-sm font-semibold text-white">Visão Geral do Patrimônio</h3>
            <p className="text-xs text-olive-200 mt-0.5">Consolidado IRPF · valores declarados</p>
          </div>
          <div className="bg-amber-50">
            {/* Asset class rows — same layout as PDF */}
            <div className="divide-y divide-gray-100">
              {[
                { label: 'Imóveis',             value: patrimonio.imoveis },
                { label: 'Ativos Financeiros',  value: patrimonio.ativos },
                { label: 'Participações',        value: patrimonio.participacoes },
                { label: 'Créditos',            value: patrimonio.creditos },
                ...((patrimonio.outros ?? 0) > 0
                  ? [{ label: 'Outros bens', value: patrimonio.outros ?? 0 }]
                  : []),
              ].map(({ label, value }, i) => (
                <div
                  key={label}
                  className={`flex items-center justify-between px-5 py-3 ${i % 2 === 0 ? 'bg-amber-50' : 'bg-white'}`}
                >
                  <span className="text-sm text-gray-600">{label}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-800 tabular-nums">{formatBRL(value)}</span>
                    {totalPatrimonio > 0 && value > 0 && (
                      <span className="ml-3 text-xs text-gray-400">
                        {Math.round((value / totalPatrimonio) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total row */}
            <div className="flex justify-between items-center px-5 py-3 border-t-2 border-olive-200">
              <span className="text-sm font-semibold text-gray-700">Total consolidado</span>
              <span className="text-sm font-bold text-olive-900 tabular-nums">{formatBRL(totalPatrimonio)}</span>
            </div>

            {/* Reconciliation row */}
            {totalDeclarado !== undefined && totalDeclarado > 0 && (
              <div className="flex justify-between items-center px-5 py-2.5 border-t border-dashed border-amber-200">
                <span className="text-xs text-gray-400">Total declarado IRPF</span>
                <span className="text-xs font-medium text-gray-500 tabular-nums">{formatBRL(totalDeclarado)}</span>
              </div>
            )}

            {/* Gap warning */}
            {reconcGap > 1 && (
              <div className="mx-5 mb-4 mt-1 bg-amber-100 border border-amber-300 rounded-lg px-4 py-3 flex items-start gap-2">
                <span className="text-amber-600 text-sm font-medium mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-medium text-amber-800">Divergência de reconciliação</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Diferença de {formatBRL(reconcGap)} ({reconcPct.toFixed(1)}%) entre o total consolidado e o total declarado no IRPF.
                    Revise a ficha Bens e Direitos — pode haver itens não classificados ou com valor incorreto.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contatos Essenciais */}
      <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
        <div className="bg-olive-900 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Contatos Essenciais</h3>
          <p className="text-xs text-olive-200 mt-0.5">
            {contatosEssenciais.length > 0
              ? `${contatosEssenciais.length} contatos em ordem de acionamento`
              : 'A acionar em caso de falecimento · por ordem de prioridade'}
          </p>
        </div>
        <div className="bg-amber-50">
          {contatosEssenciais.length > 0 && (
            <>
              {/* Column header */}
              <div className="grid grid-cols-[32px_32px_1fr_100px_32px] items-center gap-3 px-4 py-2 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center">#</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center">Nível</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nome / Função</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide hidden sm:block">Contato</span>
                <div />
              </div>
              <div className="divide-y divide-gray-100">
                {contatosEssenciais.map((c, i) => (
                  <ContatoEssencialRow
                    key={i}
                    contato={c}
                    index={i}
                    onUpdate={(field, value) => updateContatoEssencial(i, field, value)}
                    onRemove={() => removeContatoEssencial(i)}
                  />
                ))}
              </div>
            </>
          )}
          <div className="px-5 py-3">
            <button
              onClick={addContatoEssencial}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
            >
              + Adicionar contato essencial
            </button>
          </div>
        </div>
      </div>

      {/* Documentos NCM / Dropbox */}
      <div className="rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
        <div className="bg-olive-900 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Documentos e Repositórios Digitais</h3>
          <p className="text-xs text-olive-200 mt-0.5">Caminhos no Dropbox NCM e demais repositórios</p>
        </div>
        <div className="bg-amber-50">
          {documentosDropbox.length > 0 && (
            <>
              <div className="grid grid-cols-[1fr_160px_32px] gap-3 px-4 py-2 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Descrição / Caminho</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Responsável</span>
                <div />
              </div>
              <div className="divide-y divide-gray-100">
                {documentosDropbox.map((doc, i) => (
                  <DocumentoDropboxRow
                    key={i}
                    doc={doc}
                    index={i}
                    onUpdate={(field, value) => updateDocumentoDropbox(i, field, value)}
                    onRemove={() => removeDocumentoDropbox(i)}
                  />
                ))}
              </div>
            </>
          )}
          <div className="px-5 py-3">
            <button
              onClick={addDocumentoDropbox}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
            >
              + Adicionar repositório / pasta
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
