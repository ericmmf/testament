// @react-pdf/renderer — server-side only, called from API route
// Do NOT import this from client components.

import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
} from '@react-pdf/renderer'
import { PlaybookData, ContatoEssencial, UrgenciaContato } from '@/lib/types/playbook'
import { styles, COLORS } from './styles'
import { formatBRL, formatDate, formatCPF } from './utils'
export type { PDFSection } from './types'
import type { PDFSection } from './types'

// ── Shared sub-components ─────────────────────────────────────────────────────

function PageWrapper({
  clientName,
  children,
}: {
  clientName: string
  children: React.ReactNode
}) {
  return (
    <Page size="A4" style={styles.page}>
      {/* Running header */}
      <View style={styles.pageHeader} fixed>
        <Text style={styles.pageHeaderBrand}>TESTAMENT</Text>
        <Text style={styles.pageHeaderClient}>{clientName}</Text>
        <Text
          style={styles.pageHeaderPage}
          render={({ pageNumber: p, totalPages: t }) => `${p} / ${t}`}
        />
      </View>

      {/* Content area */}
      <View style={{ marginTop: 28 }}>
        {children}
      </View>

      {/* Running footer */}
      <View style={styles.pageFooter} fixed>
        <Text style={styles.pageFooterText}>Documento confidencial</Text>
        <Text style={styles.pageFooterText}>
          {`Gerado em ${new Date().toLocaleDateString('pt-BR')}`}
        </Text>
      </View>
    </Page>
  )
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  )
}

function CardPDF({
  title,
  subtitle,
  rightLabel,
  rightValue,
  badges,
  children,
}: {
  title: string
  subtitle?: string
  rightLabel?: string
  rightValue?: string
  badges?: { label: string; color: string }[]
  children?: React.ReactNode
}) {
  return (
    <View style={styles.card} wrap={false}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardHeaderTitle}>{title}</Text>
          {subtitle && <Text style={styles.cardHeaderSubtitle}>{subtitle}</Text>}
          {badges && badges.length > 0 && (
            <View style={{ flexDirection: 'row', marginTop: 6, flexWrap: 'wrap' }}>
              {badges.map((b, i) => (
                <View key={i} style={[styles.badge, { backgroundColor: b.color }]}>
                  <Text style={[styles.badgeText, { color: COLORS.white }]}>{b.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {(rightLabel || rightValue) && (
          <View style={{ alignItems: 'flex-end' }}>
            {rightLabel && <Text style={styles.cardHeaderValueLabel}>{rightLabel}</Text>}
            {rightValue && <Text style={styles.cardHeaderValue}>{rightValue}</Text>}
          </View>
        )}
      </View>

      {/* Body */}
      {children && (
        <View style={styles.cardBody}>
          {children}
        </View>
      )}
    </View>
  )
}

function FieldRow({ fields }: { fields: { label: string; value: string; mono?: boolean }[] }) {
  return (
    <View style={styles.fieldRow}>
      {fields.map((f, i) => (
        <View key={i} style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <Text style={f.mono ? styles.fieldValueMono : styles.fieldValue}>{f.value || '—'}</Text>
        </View>
      ))}
    </View>
  )
}

// ── Cover page ────────────────────────────────────────────────────────────────

function CoverPage({ data }: { data: PlaybookData }) {
  return (
    <Page size="A4" style={[styles.page, styles.coverPage]}>
      <View style={styles.coverAccent} />
      <View style={styles.coverContent}>
        <View>
          <Text style={styles.coverLabel}>Manual de Referencia Patrimonial, Sucessão e Direcionamento</Text>
          <Text style={styles.coverTitle}>{data.dadosPessoais.nome}</Text>
          <Text style={styles.coverCpf}>{formatCPF(data.dadosPessoais.cpf)}</Text>
        </View>

        <View style={styles.coverMeta}>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Data de geração</Text>
            <Text style={styles.coverMetaValue}>{new Date().toLocaleDateString('pt-BR')}</Text>
          </View>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Status do playbook</Text>
            <Text style={styles.coverMetaValue}>{data.status.toUpperCase()}</Text>
          </View>
          {data.dadosPessoais.ocupacao && (
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Ocupação</Text>
              <Text style={styles.coverMetaValue}>{data.dadosPessoais.ocupacao}</Text>
            </View>
          )}
          {data.dadosPessoais.cidadanias && (
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Cidadanias</Text>
              <Text style={styles.coverMetaValue}>{data.dadosPessoais.cidadanias}</Text>
            </View>
          )}
        </View>
      </View>
    </Page>
  )
}

// ── Apresentação page ─────────────────────────────────────────────────────────

function ApresentacaoPage({ data }: { data: PlaybookData }) {
  return (
    <Page size="A4" style={[styles.page, { backgroundColor: COLORS.gray50 }]}>
      <View style={{ paddingTop: 72, paddingHorizontal: 64, paddingBottom: 64 }}>
        <Text style={[styles.sectionTitle, { fontSize: 14, marginBottom: 4, color: COLORS.gray900 }]}>
          APRESENTAÇÃO E PROPÓSITO DESTE DOCUMENTO
        </Text>
        <View style={[styles.sectionDivider, { marginBottom: 24 }]} />

        <Text style={[styles.bodyText, { marginBottom: 16, lineHeight: 1.8, color: COLORS.gray700 }]}>
          Este documento constitui o Manual de Referência Patrimonial, Sucessão e Direcionamento de{' '}
          {data.dadosPessoais.nome}. Ele foi elaborado com o propósito de reunir, de forma estruturada e
          acessível, as informações essenciais sobre o patrimônio, os vínculos familiares, as participações
          societárias e as diretrizes de conduta que devem guiar as pessoas próximas no momento em que
          esta documentação precisar ser acionada.
        </Text>

        <Text style={[styles.bodyText, { marginBottom: 16, lineHeight: 1.8, color: COLORS.gray700 }]}>
          O documento está organizado em capítulos que cobrem: dados pessoais e familiares do titular;
          intenções de partilha e diretrizes declaradas; visão consolidada do patrimônio; detalhamento
          de bens imóveis, ativos financeiros, crédito privado e participações societárias; além de
          orientações sobre localização de documentos e contatos essenciais a acionar.
        </Text>

        <Text style={[styles.bodyText, { marginBottom: 16, lineHeight: 1.8, color: COLORS.gray700 }]}>
          Este é um instrumento de planejamento e referência — não um testamento nem um documento
          jurídico com efeitos legais autônomos. Ele complementa os instrumentos formais (testamento,
          contrato social, acordos de acionistas, apólices) e deve ser lido em conjunto com eles.
          As informações aqui contidas refletem a situação declarada na data de geração e devem
          ser atualizadas periodicamente pelo assessor responsável.
        </Text>

        <Text style={[styles.bodyText, { lineHeight: 1.8, color: COLORS.gray700 }]}>
          O acesso a este documento é restrito às pessoas expressamente autorizadas pelo titular ou
          pelos responsáveis legais após o falecimento. Qualquer uso, reprodução ou divulgação a
          terceiros sem autorização é vedado.
        </Text>

        <View style={{ marginTop: 48, borderTopWidth: 1, borderTopColor: COLORS.gray300, paddingTop: 20 }}>
          <Text style={[styles.fieldLabel, { fontSize: 8, color: COLORS.gray400 }]}>DOCUMENTO CONFIDENCIAL</Text>
          <Text style={[styles.fieldValue, { marginTop: 4, fontSize: 9, color: COLORS.gray500 }]}>
            Elaborado por Testament · {new Date().toLocaleDateString('pt-BR')}
          </Text>
        </View>
      </View>
    </Page>
  )
}

// ── Section: Patrimônio (overview chapter) ────────────────────────────────────

function PatrimonioPDF({ data }: { data: PlaybookData }) {
  const clientName = data.dadosPessoais.nome
  const totalImoveis = data.imoveis.reduce((s, i) => s + i.valorDeclarado, 0)
  const totalAtivos = data.ativosFinanceiros.reduce((s, a) => s + a.valorAproximado, 0)
  const totalParticipacoes = data.participacoesSocietarias.reduce((s, p) => s + (p.valorPatrimonial ?? 0), 0)
  const totalCreditos = (data.creditos ?? []).filter(c => c.statusCredito !== 'quitado').reduce((s, c) => s + c.valorPrincipal, 0)
  const totalPatrimonio = totalImoveis + totalAtivos + totalParticipacoes

  const classes = [
    { label: 'Imóveis', value: totalImoveis, count: data.imoveis.length, unit: 'imóvel/imóveis' },
    { label: 'Ativos Financeiros', value: totalAtivos, count: data.ativosFinanceiros.length, unit: 'ativo(s)' },
    { label: 'Participações Societárias', value: totalParticipacoes, count: data.participacoesSocietarias.length, unit: 'empresa(s)' },
    { label: 'Crédito Privado (saldo ativo)', value: totalCreditos, count: (data.creditos ?? []).filter(c => c.statusCredito !== 'quitado').length, unit: 'operação(ões)' },
  ]

  return (
    <PageWrapper clientName={clientName}>
      <SectionHeading
        title="Visão Geral do Patrimônio"
        subtitle="Consolidado IRPF · valores declarados"
      />

      {/* Total box */}
      <View style={[styles.card, { backgroundColor: COLORS.blue950 }]} wrap={false}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.cardHeaderTitle, { color: COLORS.white, fontSize: 9 }]}>PATRIMÔNIO TOTAL MAPEADO</Text>
            <Text style={[styles.cardHeaderValue, { color: COLORS.white, fontSize: 18 }]}>{formatBRL(totalPatrimonio)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.cardHeaderValueLabel, { color: COLORS.oliveLight }]}>Data de referência</Text>
            <Text style={[styles.cardHeaderValue, { color: COLORS.white, fontSize: 11 }]}>
              {new Date().toLocaleDateString('pt-BR')}
            </Text>
          </View>
        </View>
      </View>

      {/* Per-class breakdown */}
      <View style={{ marginTop: 12 }}>
        {classes.map((c, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.gray100,
              backgroundColor: i % 2 === 0 ? COLORS.gray50 : COLORS.white,
            }}
            wrap={false}
          >
            <View>
              <Text style={styles.fieldValue}>{c.label}</Text>
              <Text style={styles.fieldLabel}>{c.count} {c.unit}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold' }]}>{formatBRL(c.value)}</Text>
              {totalPatrimonio > 0 && c.value > 0 && (
                <Text style={styles.fieldLabel}>
                  {Math.round((c.value / totalPatrimonio) * 100)}% do total
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </PageWrapper>
  )
}

// ── Section: Dados Pessoais ───────────────────────────────────────────────────

const URGENCIA_ICON: Record<UrgenciaContato, string> = {
  urgente: '● URGENTE',
  importante: '◐ IMPORTANTE',
  normal: '○ NORMAL',
  condicional: '◌ CONDICIONAL',
}

function DadosPessoaisPDF({ data }: { data: PlaybookData }) {
  const dp = data.dadosPessoais
  const certidao = dp.certidaoCasamento
  const contatosEssenciais = dp.contatosEssenciais ?? []
  const documentosDropbox = dp.documentosDropbox ?? []

  return (
    <PageWrapper clientName={dp.nome}>
      <SectionHeading title="Dados Pessoais" subtitle={`${dp.familiares.length} dependentes fiscais declarados`} />

      {/* Identity */}
      <CardPDF title={dp.nome} subtitle={formatCPF(dp.cpf)}>
        <FieldRow fields={[
          { label: 'Data de nascimento', value: dp.dataNascimento || '—' },
          { label: 'CPF', value: formatCPF(dp.cpf), mono: true },
        ]} />
        {(dp.cidadanias || dp.ocupacao) && (
          <FieldRow fields={[
            { label: 'Cidadanias', value: dp.cidadanias || '—' },
            { label: 'Ocupação', value: dp.ocupacao || '—' },
          ]} />
        )}
        <FieldRow fields={[{ label: 'Endereço', value: dp.endereco || '—' }]} />
        {dp.contatos.length > 0 && (
          <FieldRow fields={dp.contatos.map(c => ({ label: c.tipo, value: c.valor }))} />
        )}
      </CardPDF>

      {/* Certidão de Casamento */}
      {certidao && (certidao.regimeBens || certidao.data || certidao.nomeConjugeApos) && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.fieldLabel, { marginBottom: 8, fontSize: 8 }]}>CERTIDÃO DE CASAMENTO</Text>
          <CardPDF
            title={certidao.nomeConjugeApos ? `Cônjuge: ${certidao.nomeConjugeApos}` : 'Dados do Casamento'}
            subtitle={certidao.regimeBens}
          >
            <FieldRow fields={[
              { label: 'Data', value: certidao.data || '—' },
              { label: 'Matrícula', value: certidao.matricula || '—', mono: true },
              { label: 'Cartório', value: certidao.cartorio || '—' },
            ]} />
            {certidao.implicacaoSuccessoria && (
              <>
                <View style={styles.separator} />
                <Text style={styles.fieldLabel}>IMPLICAÇÃO SUCESSÓRIA</Text>
                <Text style={styles.bodyText}>{certidao.implicacaoSuccessoria}</Text>
              </>
            )}
          </CardPDF>
        </View>
      )}

      {/* Familiares */}
      {dp.familiares.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.fieldLabel, { marginBottom: 8, fontSize: 8 }]}>DEPENDENTES NA DECLARAÇÃO</Text>
          {dp.familiares.map((f, i) => (
            <CardPDF key={i} title={f.nome} subtitle={f.relacao}>
              {f.cpf && <FieldRow fields={[{ label: 'CPF', value: formatCPF(f.cpf), mono: true }]} />}
            </CardPDF>
          ))}
        </View>
      )}

      {/* Relações importantes */}
      {(dp.relacoesImportantes ?? []).length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.fieldLabel, { marginBottom: 8, fontSize: 8 }]}>RELAÇÕES IMPORTANTES</Text>
          {(dp.relacoesImportantes ?? []).map((r, i) => (
            <CardPDF key={i} title={r.nome} subtitle={r.relacao}>
              {r.observacao && <Text style={styles.bodyText}>{r.observacao}</Text>}
            </CardPDF>
          ))}
        </View>
      )}

      {/* Contatos Essenciais */}
      {contatosEssenciais.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { fontSize: 12, marginBottom: 2 }]}>
            CONTATOS ESSENCIAIS: QUEM LIGAR PRIMEIRO
          </Text>
          <View style={[styles.sectionDivider, { marginBottom: 8 }]} />
          <Text style={[styles.bodyText, { marginBottom: 10, color: COLORS.gray500, lineHeight: 1.6 }]}>
            Ao tomar conhecimento do meu falecimento, a seguinte sequência de contatos deve ser acionada
            o mais rapidamente possível. Cada um deles tem um papel específico na proteção e continuidade do patrimônio.
          </Text>

          {/* Table header */}
          <View style={{ flexDirection: 'row', backgroundColor: COLORS.blue950, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4 }}>
            <Text style={[styles.badgeText, { color: COLORS.white, width: 28 }]}>#</Text>
            <Text style={[styles.badgeText, { color: COLORS.white, flex: 2 }]}>NOME / INSTITUIÇÃO</Text>
            <Text style={[styles.badgeText, { color: COLORS.white, flex: 2 }]}>FUNÇÃO</Text>
            <Text style={[styles.badgeText, { color: COLORS.white, flex: 2 }]}>CONTATO</Text>
          </View>

          {/* Table rows */}
          {contatosEssenciais.map((c, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                paddingHorizontal: 10,
                paddingVertical: 8,
                backgroundColor: i % 2 === 0 ? COLORS.gray50 : COLORS.white,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.gray100,
              }}
              wrap={false}
            >
              <Text style={[styles.fieldValue, { width: 28, fontFamily: 'Helvetica-Bold' }]}>{c.prioridade}</Text>
              <View style={{ flex: 2 }}>
                <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold' }]}>{c.nome}</Text>
                {c.observacao && <Text style={[styles.fieldLabel, { fontSize: 7, marginTop: 1 }]}>{c.observacao}</Text>}
              </View>
              <Text style={[styles.fieldValue, { flex: 2 }]}>{c.funcao}</Text>
              <Text style={[styles.fieldValue, { flex: 2 }]}>{c.contato || '—'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Documentos / Repositórios Dropbox */}
      {documentosDropbox.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.fieldLabel, { marginBottom: 8, fontSize: 8 }]}>DOCUMENTOS E REPOSITÓRIOS DIGITAIS</Text>
          {documentosDropbox.map((d, i) => (
            <CardPDF key={i} title={d.descricao} subtitle={d.caminho}>
              {d.conteudo && <Text style={styles.bodyText}>{d.conteudo}</Text>}
              {d.acesso && (
                <>
                  <View style={styles.separator} />
                  <Text style={styles.fieldLabel}>COMO ACESSAR</Text>
                  <Text style={styles.bodyText}>{d.acesso}</Text>
                </>
              )}
            </CardPDF>
          ))}
        </View>
      )}
    </PageWrapper>
  )
}

// ── Section: Briefing ─────────────────────────────────────────────────────────

function BriefingPDF({ data }: { data: PlaybookData }) {
  const b = data.briefing
  if (!b) return null
  const clientName = data.dadosPessoais.nome
  return (
    <PageWrapper clientName={clientName}>
      <SectionHeading title="Briefing do Cliente" subtitle="Intenções e diretrizes declaradas" />

      {b.intencoesPartilha && (
        <CardPDF title="Intenções de Partilha">
          <Text style={styles.bodyText}>{b.intencoesPartilha}</Text>
        </CardPDF>
      )}
      {b.tutoresCuradores && (
        <CardPDF title="Tutores e Curadores Sugeridos">
          <Text style={styles.bodyText}>{b.tutoresCuradores}</Text>
        </CardPDF>
      )}
      {(b.conselheirosConfianca ?? []).length > 0 && (
        <CardPDF title="Conselheiros e Pessoas-Chave">
          {(b.conselheirosConfianca ?? []).map((c, i) => (
            <View key={i}>
              {i > 0 && <View style={styles.separator} />}
              <FieldRow fields={[
                { label: 'Nome', value: c.nome },
                { label: 'Papel', value: c.papel },
                { label: 'Contato', value: c.telefone || c.email || '—' },
              ]} />
            </View>
          ))}
        </CardPDF>
      )}
      {b.diretrizes && (
        <CardPDF title="Diretrizes Gerais">
          <Text style={styles.bodyText}>{b.diretrizes}</Text>
        </CardPDF>
      )}
    </PageWrapper>
  )
}

// ── Section: Imóveis ──────────────────────────────────────────────────────────

function ImoveisPDF({ data }: { data: PlaybookData }) {
  const clientName = data.dadosPessoais.nome
  const imoveis = data.imoveis
  const total = imoveis.reduce((s, i) => s + i.valorDeclarado, 0)
  return (
    <PageWrapper clientName={clientName}>
      <SectionHeading title="Imóveis" subtitle={`${imoveis.length} ${imoveis.length === 1 ? 'imóvel' : 'imóveis'} · Total: ${formatBRL(total)}`} />
      {imoveis.length === 0 && <Text style={styles.emptyText}>Nenhum imóvel registrado.</Text>}
      {imoveis.map((im, i) => (
        <CardPDF
          key={i}
          title={im.descricao || 'Imóvel sem descrição'}
          subtitle={im.endereco}
          rightLabel="Valor declarado"
          rightValue={formatBRL(im.valorDeclarado)}
          badges={[
            ...(im.source === 'dec' ? [{ label: '.DEC', color: COLORS.blue900 }] : []),
            ...(im.needsReview ? [{ label: 'revisar', color: '#d97706' }] : []),
          ]}
        >
          <FieldRow fields={[
            { label: 'Matrícula', value: im.matricula || '—', mono: true },
            { label: 'Cartório', value: im.cartorio || '—' },
            { label: '% Propriedade', value: im.percentualPropriedade ? `${im.percentualPropriedade}%` : '100%' },
          ]} />
          {im.observacoes && <Text style={styles.bodyText}>{im.observacoes}</Text>}
        </CardPDF>
      ))}
    </PageWrapper>
  )
}

// ── Section: Ativos Financeiros ───────────────────────────────────────────────
// Layout: institution header (wrap=false) + one row per ativo (wrap=false each).
// Do NOT wrap the whole institution block — institutions with many items overflow.

function AtivosPDF({ data }: { data: PlaybookData }) {
  const clientName = data.dadosPessoais.nome
  const ativos = data.ativosFinanceiros
  const total = ativos.reduce((s, a) => s + a.valorAproximado, 0)

  // Group by institution; unnamed → 'A Classificar'
  const grouped = new Map<string, typeof ativos>()
  for (const a of ativos) {
    const key = a.instituicao?.trim() || 'A Classificar'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(a)
  }

  return (
    <PageWrapper clientName={clientName}>
      <SectionHeading
        title="Ativos Financeiros"
        subtitle={`${grouped.size} ${grouped.size === 1 ? 'instituição' : 'instituições'} · Total: ${formatBRL(total)}`}
      />
      {ativos.length === 0 && <Text style={styles.emptyText}>Nenhum ativo financeiro registrado.</Text>}

      {Array.from(grouped.entries()).map(([inst, items]) => {
        const instTotal = items.reduce((s, a) => s + a.valorAproximado, 0)
        return (
          <View key={inst} style={{ marginBottom: 16 }}>

            {/* Institution header — non-wrapping */}
            <View
              wrap={false}
              style={{
                backgroundColor: COLORS.blue950,
                borderRadius: 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 2,
              }}
            >
              <Text style={styles.cardHeaderTitle}>{inst}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardHeaderValueLabel}>Total custodiado</Text>
                <Text style={styles.cardHeaderValue}>{formatBRL(instTotal)}</Text>
              </View>
            </View>

            {/* One row per ativo — each non-wrapping */}
            {items.map((a, i) => (
              <View
                key={i}
                wrap={false}
                style={{
                  backgroundColor: i % 2 === 0 ? COLORS.gray50 : COLORS.white,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.gray100,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                {/* Product + value on one line */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold' }]}>{a.tipo}</Text>
                    {a.cnpj && (
                      <Text style={[styles.fieldValueMono, { fontSize: 7.5, color: COLORS.gray400, marginTop: 1 }]}>
                        {a.cnpj}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold', textAlign: 'right' }]}>
                    {formatBRL(a.valorAproximado)}
                  </Text>
                </View>
                {/* Description clipped to 120 chars to avoid overflow */}
                {a.descricao && (
                  <Text
                    style={[styles.fieldLabel, { marginTop: 2, fontSize: 7.5, color: COLORS.gray400 }]}
                  >
                    {a.descricao.length > 120 ? a.descricao.slice(0, 120) + '…' : a.descricao}
                  </Text>
                )}
              </View>
            ))}

            {/* Institution subtotal footer */}
            <View
              wrap={false}
              style={{
                backgroundColor: COLORS.gray100,
                paddingHorizontal: 14,
                paddingVertical: 6,
                flexDirection: 'row',
                justifyContent: 'space-between',
                borderRadius: 0,
                marginBottom: 4,
              }}
            >
              <Text style={[styles.fieldLabel, { fontSize: 7.5 }]}>{items.length} ativo{items.length !== 1 ? 's' : ''}</Text>
              <Text style={[styles.fieldLabel, { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: COLORS.gray700 }]}>
                {formatBRL(instTotal)}
              </Text>
            </View>
          </View>
        )
      })}
    </PageWrapper>
  )
}

// ── Section: Crédito ─────────────────────────────────────────────────────────

function CreditoPDF({ data }: { data: PlaybookData }) {
  const clientName = data.dadosPessoais.nome
  const creditos = data.creditos ?? []
  const totalAtivo = creditos.filter(c => c.statusCredito !== 'quitado').reduce((s, c) => s + c.valorPrincipal, 0)

  const STATUS_LABELS: Record<string, string> = {
    ativo: 'Ativo', em_atraso: 'Em atraso', renegociado: 'Renegociado', quitado: 'Quitado',
  }
  const STATUS_BADGE_COLORS: Record<string, string> = {
    ativo: '#059669', em_atraso: '#dc2626', renegociado: '#d97706', quitado: COLORS.gray400,
  }

  return (
    <PageWrapper clientName={clientName}>
      <SectionHeading title="Crédito Privado e Estruturado" subtitle={`${creditos.length} operações · Saldo ativo: ${formatBRL(totalAtivo)}`} />
      {creditos.length === 0 && <Text style={styles.emptyText}>Nenhuma operação de crédito registrada.</Text>}
      {creditos.map((c, i) => (
        <CardPDF
          key={i}
          title={c.devedor}
          subtitle={c.cnpjCpf ? `${c.tipoPessoa} · ${c.cnpjCpf}` : c.tipoPessoa}
          rightLabel="Principal"
          rightValue={formatBRL(c.valorPrincipal)}
          badges={[
            { label: c.tipoPessoa, color: c.tipoPessoa === 'PJ' ? '#44403c' : '#78716c' },
            ...(c.tipoInstrumento ? [{ label: c.tipoInstrumento, color: COLORS.blue900 }] : []),
            ...(c.statusCredito ? [{ label: STATUS_LABELS[c.statusCredito] ?? c.statusCredito, color: STATUS_BADGE_COLORS[c.statusCredito] ?? COLORS.gray400 }] : []),
          ]}
        >
          <FieldRow fields={[
            { label: 'Taxa de juros', value: c.taxaJuros || '—' },
            { label: 'Vencimento', value: c.dataVencimento || '—' },
            { label: 'Instrumento', value: c.tipoInstrumento || '—' },
          ]} />
          {c.garantias && (
            <>
              <View style={styles.separator} />
              <Text style={styles.fieldLabel}>GARANTIAS</Text>
              <Text style={styles.bodyText}>{c.garantias}</Text>
            </>
          )}
          {c.observacoes && (
            <>
              <View style={styles.separator} />
              <Text style={styles.bodyText}>{c.observacoes}</Text>
            </>
          )}
          {(c.anexos ?? []).length > 0 && (
            <>
              <View style={styles.separator} />
              <Text style={styles.fieldLabel}>CONTRATOS ANEXOS</Text>
              {(c.anexos ?? []).map((a, ai) => (
                <Text key={ai} style={[styles.fieldValue, { fontSize: 8 }]}>
                  {a.status === 'enviado' ? '✓ ' : '○ '}{a.nome}
                </Text>
              ))}
            </>
          )}
        </CardPDF>
      ))}
    </PageWrapper>
  )
}

// ── Section: Participações ────────────────────────────────────────────────────

function ParticipacoesPDF({ data }: { data: PlaybookData }) {
  const clientName = data.dadosPessoais.nome
  const participacoes = data.participacoesSocietarias
  const totalValor = participacoes.reduce((s, p) => s + (p.valorPatrimonial ?? 0), 0)
  return (
    <PageWrapper clientName={clientName}>
      <SectionHeading
        title="Participações Societárias"
        subtitle={`${participacoes.length} ${participacoes.length === 1 ? 'empresa' : 'empresas'} privadas${totalValor > 0 ? ` · ${formatBRL(totalValor)}` : ''}`}
      />
      {participacoes.length === 0 && <Text style={styles.emptyText}>Nenhuma participação em empresa privada registrada.</Text>}
      {participacoes.map((p, i) => (
        <CardPDF
          key={i}
          title={p.empresa}
          subtitle={p.cnpj}
          rightLabel="Participação"
          rightValue={p.percentual > 0 ? `${p.percentual}%` : '—'}
        >
          <FieldRow fields={[
            { label: 'Natureza jurídica', value: p.naturezaJuridica || '—' },
            { label: 'Valor patrimonial', value: p.valorPatrimonial ? formatBRL(p.valorPatrimonial) : '—' },
            { label: 'Método de avaliação', value: p.metodoAvaliacao || '—' },
          ]} />
          {(p.outrosSocios ?? []).length > 0 && (
            <>
              <View style={styles.separator} />
              <Text style={styles.fieldLabel}>OUTROS SÓCIOS</Text>
              {(p.outrosSocios ?? []).map((s, si) => (
                <FieldRow key={si} fields={[
                  { label: 'Nome', value: s.nome },
                  { label: '%', value: `${s.percentual}%` },
                ]} />
              ))}
            </>
          )}
        </CardPDF>
      ))}
    </PageWrapper>
  )
}

// ── Section: Documentos ───────────────────────────────────────────────────────

function DocumentosPDF({ data }: { data: PlaybookData }) {
  const clientName = data.dadosPessoais.nome
  const docs = data.documentosVitais ?? []
  const sent = docs.filter(d => d.status === 'enviado').length
  return (
    <PageWrapper clientName={clientName}>
      <SectionHeading title="Documentos Vitais" subtitle={`${sent} de ${docs.length} documentos enviados`} />
      {docs.length === 0 && <Text style={styles.emptyText}>Nenhum documento registrado.</Text>}
      {docs.map((d, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: d.status === 'enviado' ? COLORS.emerald : COLORS.gray100, marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldValue, { fontFamily: d.status === 'enviado' ? 'Helvetica-Bold' : 'Helvetica' }]}>{d.nome}</Text>
            {d.fileName && <Text style={[styles.fieldLabel, { marginTop: 1 }]}>{d.fileName}</Text>}
          </View>
          <Text style={[styles.badgeText, { color: d.status === 'enviado' ? COLORS.emerald : COLORS.gray300 }]}>
            {d.status === 'enviado' ? 'ENVIADO' : 'PENDENTE'}
          </Text>
        </View>
      ))}
    </PageWrapper>
  )
}

// ── Root document ─────────────────────────────────────────────────────────────

interface Props {
  data: PlaybookData
  sections: PDFSection[]
}

export function PlaybookPDFDocument({ data, sections }: Props) {
  const set = new Set(sections)
  return (
    <Document
      title={`Manual de Referencia Patrimonial, Sucessão e Direcionamento — ${data.dadosPessoais.nome}`}
      author="Testament"
      subject="Planejamento Sucessório"
    >
      {/* Cover always included */}
      <CoverPage data={data} />

      {/* Apresentação always included */}
      <ApresentacaoPage data={data} />

      {set.has('briefing') && data.briefing && <BriefingPDF data={data} />}
      {set.has('dadosPessoais') && <DadosPessoaisPDF data={data} />}
      {set.has('patrimonio') && <PatrimonioPDF data={data} />}
      {set.has('imoveis') && <ImoveisPDF data={data} />}
      {set.has('ativosFinanceiros') && <AtivosPDF data={data} />}
      {set.has('creditos') && (data.creditos ?? []).length > 0 && <CreditoPDF data={data} />}
      {set.has('participacoesSocietarias') && <ParticipacoesPDF data={data} />}
      {set.has('documentos') && <DocumentosPDF data={data} />}
    </Document>
  )
}
