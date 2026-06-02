import type { ExportFormat, FormulacaoInsumo, FormulacaoQueijo } from '../../api/producaoApi'
import { ExportFormatMenu } from '../../shared/ExportFormatMenu'
import { formatDate, formatNumber } from '../../shared/formatters'

export function VisualizacaoFormulacaoQueijo({
  item,
  onExport,
}: {
  item: FormulacaoQueijo
  onExport: (format: ExportFormat) => void
}) {
  const insumos = groupInsumos(item.insumos)

  return (
    <section className="document-view">
      <div className="document-actions">
        {item.status === 'finalizada' && <ExportFormatMenu onExport={onExport} />}
      </div>

      <article className="document-sheet document-sheet-compact">
        <header className="document-header">
          <div>
            <h2>Controle de formulação do queijo</h2>
            <span>Ficha preenchida</span>
          </div>
        </header>

        <div className="document-form-list">
          <DocumentLine label="Código da Formulação" value={item.codigo_formulacao} />
          <DocumentLine label="Tipo de Queijo" value={item.tipo_queijo} />
          <DocumentLine label="Data" value={formatDate(item.data_formulacao)} />
          <DocumentLine label="Silo" value={item.silo} />
          <DocumentLine label="Lote do Leite" value={item.lote_leite} />
          <DocumentLine label="Lote do Queijo" value={item.lote_queijo} />
          <DocumentLine label="Nº Queijomatic" value={item.numero_queijomatic} />
          <DocumentLine label="Início Enchimento" value={item.inicio_enchimento} />
          <DocumentLine label="Quantidade Leite" value={formatNumber(item.quantidade_leite, ' L')} />
          <DocumentLine label="Temperatura de Pasteurização" value={formatNumber(item.temperatura_pasteurizacao, ' °C')} />
          <DocumentLine label="Fosfatase" value={resultLabel(item.fosfatase)} />
          <DocumentLine label="Peroxidase" value={resultLabel(item.peroxidase)} />
          <DocumentLine label="Quantidade de Fermento (MVD)" value={insumos.fermento_mvd.quantidade} />
          <DocumentLine label="Lote do Fermento" value={insumos.fermento_mvd.lote} />
          <DocumentLine label="Quantidade de Fermento (FAST)" value={insumos.fermento_fast.quantidade} />
          <DocumentLine label="Lote do Fermento" value={insumos.fermento_fast.lote} />
          <DocumentLine label="Quantidade de Fermento" value={insumos.fermento.quantidade} />
          <DocumentLine label="Lote do Fermento" value={insumos.fermento.lote} />
          <DocumentLine label="Quantidade de Cloreto" value={insumos.cloreto.quantidade} />
          <DocumentLine label="Lote do Cloreto" value={insumos.cloreto.lote} />
          <DocumentLine label="Quantidade de Corante" value={insumos.corante.quantidade} />
          <DocumentLine label="Lote do Corante" value={insumos.corante.lote} />
          <DocumentLine label="Quantidade de Coalho" value={insumos.coalho.quantidade} />
          <DocumentLine label="Lote do Coalho" value={insumos.coalho.lote} />
          <DocumentLine label="Gordura Inicial" value={formatNumber(item.gordura_inicial, ' %')} />
          <DocumentLine label="Gordura Final" value={formatNumber(item.gordura_final, ' %')} />
          <DocumentLine label="Acidez" value={formatNumber(item.acidez, ' °D')} />
          <DocumentLine label="Temperatura da Coagulação" value={formatNumber(item.temperatura_coagulacao, ' °C')} />
          <DocumentLine label="Hora da Coagulação" value={item.hora_coagulacao} />
          <DocumentLine label="Hora do Corte" value={item.hora_corte} />
          <DocumentLine label="Temperatura de Cozimento" value={formatNumber(item.temperatura_cozimento, ' °C')} />
          <DocumentLine label="Responsável pela Produção" value={item.responsavel_id ? String(item.responsavel_id) : null} />
        </div>
      </article>
    </section>
  )
}

function DocumentLine({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="document-line">
      <span>{label}</span>
      <strong>{value === null || value === undefined || value === '' ? '-' : value}</strong>
    </div>
  )
}

function resultLabel(value: FormulacaoQueijo['fosfatase']) {
  if (value === 'negativo') return 'Negativo'
  if (value === 'positivo') return 'Positivo'
  if (value === 'nao_aplicavel') return 'Não aplicável'
  return '-'
}

function groupInsumos(items: FormulacaoInsumo[]) {
  const groups = {
    fermento_mvd: emptyInsumo(),
    fermento_fast: emptyInsumo(),
    fermento: emptyInsumo(),
    cloreto: emptyInsumo(),
    corante: emptyInsumo(),
    coalho: emptyInsumo(),
  }

  items.forEach((item) => {
    const key = item.tipo_insumo in groups ? item.tipo_insumo as keyof typeof groups : null
    if (key === null) return
    const quantidade = `${formatNumber(item.quantidade)} ${item.unidade || ''}`.trim()
    groups[key].quantidade = joinValue(groups[key].quantidade, quantidade)
    groups[key].lote = joinValue(groups[key].lote, item.lote_insumo || '')
  })

  return groups
}

function emptyInsumo() {
  return { quantidade: '', lote: '' }
}

function joinValue(current: string, next: string) {
  if (!next) return current
  return current ? `${current}; ${next}` : next
}
