import { Check, History, RotateCcw } from 'lucide-react'
import type { OperacaoEmbalagem } from '../api/embalagemApi'

export function OperacaoLote({
  operacao,
  codigoBarra,
  ultimoCodigo,
  pecasAvulsas,
  processando,
  onCodigoChange,
  onPecasAvulsasChange,
  onFinalizar,
  onAbrirHistorico,
  onNovaOp,
}: {
  operacao: OperacaoEmbalagem
  codigoBarra: string
  ultimoCodigo: string
  pecasAvulsas: number
  processando: boolean
  onCodigoChange: (value: string) => void
  onPecasAvulsasChange: (value: number) => void
  onFinalizar: () => void
  onAbrirHistorico: () => void
  onNovaOp: () => void
}) {
  const pesoDigitado = parsePeso(codigoBarra, operacao.barcode)
  const pesoUltimo = parsePeso(ultimoCodigo, operacao.barcode)
  const pesoVisivel = pesoDigitado ?? pesoUltimo
  const codigoEtiqueta = codigoBarra.length >= operacao.barcode.length ? codigoBarra : ultimoCodigo

  return (
    <div className="operation">
      <section className="summary-line">
        <div>
          <span className="section-kicker">Ordem</span>
          <h2>{operacao.ordem.codigo}</h2>
        </div>
        <Info label="Queijo" value={operacao.lote.nome_queijo} />
        <Info label="Lote" value={operacao.lote.lote} />
        <Info label="Fabricação" value={operacao.lote.data_fabricacao ?? '-'} />
        <Info label="Validade" value={operacao.lote.data_validade ?? '-'} />
        <button className="icon-btn" type="button" onClick={onNovaOp} title="Trocar OP">
          <RotateCcw size={17} />
        </button>
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Balança</span>
              <h2>Registrar caixa</h2>
            </div>
          </div>

          <div className="scale-row">
            <div className="scale-display">
              <span>Peso</span>
              <strong>{pesoVisivel ? formatWeight(pesoVisivel) : '0,000'}</strong>
              <small>kg</small>
            </div>
            <EtiquetaBalanca
              codigo={codigoEtiqueta}
              lote={operacao.lote.lote}
              nomeQueijo={operacao.lote.nome_queijo}
              dataFabricacao={operacao.lote.data_fabricacao}
              dataValidade={operacao.lote.data_validade}
              peso={pesoVisivel}
            />
          </div>

          <div className="scan-form">
            <label className="field">
              <span>Código da balança</span>
              <input
                className="control scan-input"
                value={codigoBarra}
                onChange={(event) => onCodigoChange(event.target.value)}
                placeholder="Escaneie o código"
                inputMode="numeric"
                autoFocus
                disabled={operacao.lote.status === 'finalizado'}
              />
            </label>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Contadores</span>
              <h2>Operação</h2>
            </div>
            <button className="btn secondary compact-btn" type="button" onClick={onAbrirHistorico}>
              <History size={16} />
              Histórico
            </button>
          </div>

          <div className="mini-stats">
            <Info label="Caixas" value={formatInt(operacao.lote.caixas_total)} />
            <Info label="Peças" value={formatInt(operacao.lote.pecas_total)} />
            <Info label="Peso" value={`${formatWeight(operacao.lote.peso_total)} kg`} />
            <Info label="Palete" value={operacao.palete_atual ? `${operacao.palete_atual.caixas}/${operacao.lote.caixas_por_palete}` : '-'} />
          </div>

          <div className="finish-row">
            <label className="field compact-field">
              <span>Peças avulsas</span>
              <input className="control" min={0} type="number" value={pecasAvulsas || ''} onChange={(event) => onPecasAvulsasChange(Number(event.target.value || 0))} />
            </label>
            <button className="btn secondary" disabled={processando || operacao.lote.status === 'finalizado'} type="button" onClick={onFinalizar}>
              <Check size={17} />
              Finalizar OP
            </button>
          </div>
        </div>
      </section>

      <section className="panel pallet-panel">
        <span className="section-kicker">Paletes</span>
        <h2>Controle</h2>
        <div className="pallet-grid">
          {operacao.paletes.map((palete) => (
            <article className="pallet-card" key={palete.id}>
              <strong>Palete {palete.numero}</strong>
              <span>{palete.status}</span>
              <p>{palete.caixas}/{operacao.lote.caixas_por_palete} caixas</p>
              <p>{formatWeight(palete.peso_total)} kg</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function EtiquetaBalanca({
  nomeQueijo,
  dataFabricacao,
  dataValidade,
  lote,
  peso,
  codigo,
}: {
  nomeQueijo: string
  dataFabricacao: string | null
  dataValidade: string | null
  lote: string
  peso: number | null
  codigo: string
}) {
  const digits = codigo.replace(/\D/g, '')

  return (
    <div className="label-preview label-ticket" aria-label="Prévia da etiqueta">
      <strong>QUEIJO {nomeQueijo}</strong>
      <div className="ticket-rule" />
      <div className="ticket-row">
        <span>DATA DE FAB.:</span>
        <b>{formatShortDate(dataFabricacao)}</b>
      </div>
      <div className="ticket-row">
        <span>DATA DE VAL.:</span>
        <b>{formatShortDate(dataValidade)}</b>
      </div>
      <div className="ticket-row">
        <span>LOTE:</span>
        <b>{lote || '-'}</b>
      </div>
      <div className="ticket-row">
        <span>TARA:</span>
        <b>0,358kg(T)</b>
      </div>
      <div className="ticket-band">PESO LIQUIDO</div>
      <div className="ticket-weight">{peso ? `${formatWeight(peso)}kg` : '--'}</div>
      <div className="barcode-bars" aria-hidden="true" />
      <div className="barcode-digits">{formatBarcode(digits)}</div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function parsePeso(codigo: string, barcode: OperacaoEmbalagem['barcode']): number | null {
  const digits = codigo.replace(/\D/g, '')
  if (digits.length < barcode.weight_start + barcode.weight_length - 1) return null
  const raw = digits.slice(barcode.weight_start - 1, barcode.weight_start - 1 + barcode.weight_length)
  if (!/^\d+$/.test(raw)) return null
  return Number(raw) / barcode.weight_divisor
}

function formatBarcode(value: string) {
  if (!value) return '-'
  return value.replace(/^(\d)(\d{5})(\d{5})(\d{2})$/, '$1 $2 $3 $4')
}

function formatInt(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function formatWeight(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: false })
}

function formatShortDate(value: string | null) {
  if (!value) return '-'
  const [day, month, year] = value.includes('/') ? value.split('/') : value.split('-').reverse()
  if (!day || !month || !year) return value
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year.slice(-2)}`
}
