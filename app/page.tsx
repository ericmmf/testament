'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Client {
  id: string
  full_name: string
  cpf: string
  email: string | null
  status: string
  created_at: string
}

function formatCPF(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 11) return raw
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ingesting:  { label: 'Processando',  cls: 'bg-gray-100 text-gray-500' },
    draft:      { label: 'Rascunho',     cls: 'bg-gray-100 text-gray-600' },
    in_review:  { label: 'Em revisão',   cls: 'bg-olive-100 text-olive-700' },
    approved:   { label: 'Aprovado',     cls: 'bg-green-100 text-green-700' },
    delivered:  { label: 'Entregue',     cls: 'bg-blue-100 text-blue-700' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-400' }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

export default function Home() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setClients(data)
        else setError('Erro ao carregar clientes')
      })
      .catch(() => setError('Erro ao carregar clientes'))
      .finally(() => setLoading(false))
  }, [])

  function handleRowClick(client: Client) {
    // Navigate to playbook if past ingesting
    if (client.status !== 'ingesting') {
      router.push(`/clientes/${client.id}/playbook`)
    }
  }

  return (
    <main className="min-h-screen bg-amber-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Testament</h1>
          <p className="text-xs text-gray-400 mt-0.5">Plataforma de planejamento patrimonial</p>
        </div>
        <Link
          href="/novo-cliente"
          className="bg-olive-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-olive-800 transition-colors"
        >
          + Novo Cliente
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">

        {loading && (
          <p className="text-sm text-gray-400 text-center py-16">Carregando clientes…</p>
        )}

        {error && (
          <p className="text-sm text-red-500 text-center py-16">{error}</p>
        )}

        {!loading && !error && clients.length === 0 && (
          <div className="text-center py-24">
            <p className="text-sm text-gray-400 mb-4">Nenhum cliente cadastrado ainda.</p>
            <Link
              href="/novo-cliente"
              className="text-sm text-gray-900 font-medium underline hover:no-underline"
            >
              Cadastrar primeiro cliente →
            </Link>
          </div>
        )}

        {!loading && clients.length > 0 && (
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">CPF</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Criado em</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clients.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => handleRowClick(c)}
                    className={`transition-colors ${c.status !== 'ingesting' ? 'cursor-pointer hover:bg-amber-50' : 'opacity-60'}`}
                  >
                    <td className="px-5 py-4 font-medium text-gray-900">{c.full_name}</td>
                    <td className="px-5 py-4 text-gray-500 font-mono text-xs">{formatCPF(c.cpf)}</td>
                    <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                    <td className="px-5 py-4 text-right">
                      {c.status !== 'ingesting' && (
                        <span className="text-xs text-gray-400 hover:text-gray-700">
                          Ver playbook →
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
