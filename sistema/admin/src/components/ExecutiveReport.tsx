import React, { useState } from 'react'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface ReportData {
  period: {
    weekStart: string
    weekEnd: string
  }
  summary: {
    totalRevenue: number
    totalOrders: number
    conversionRate: number
    cartAbandonRate: number
    averageOrderValue: number
  }
  topCategories: Array<{
    category: string
    revenue: number
    orders: number
    percentage: number
  }>
  topSearchTerms: Array<{
    term: string
    count: number
    results: number
    noResultRate: number
  }>
  catalogGaps: Array<{
    term: string
    searchCount: number
    noResultsCount: number
  }>
  recommendations: string[]
}

interface ExecutiveReportProps {
  apiUrl: string
  token: string
}

export const ExecutiveReport: React.FC<ExecutiveReportProps> = ({ apiUrl, token }) => {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<string>('')

  const loadReport = async (weekDate?: string) => {
    setLoading(true)
    try {
      const query = weekDate ? `?week=${weekDate}` : ''
      const response = await fetch(`${apiUrl}/analytics/report-executive${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      setReport(data)
    } catch (error) {
      console.error('Erro ao carregar relatório:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = async () => {
    try {
      const query = selectedWeek ? `?week=${selectedWeek}&format=csv` : '?format=csv'
      const response = await fetch(`${apiUrl}/analytics/report-executive${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const csv = await response.text()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      const fileName = `relatorio-executivo-${selectedWeek || new Date().toISOString().split('T')[0]}.csv`
      link.setAttribute('href', url)
      link.setAttribute('download', fileName)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Erro ao fazer download:', error)
    }
  }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <Label htmlFor="executive-report-week" className="block text-sm font-medium text-gray-700 mb-2">
            Semana (segunda-feira)
          </Label>
          <Input
            id="executive-report-week"
            type="date"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          />
        </div>
        <Button
          type="button"
          onClick={() => loadReport(selectedWeek)}
          disabled={loading}
        >
          {loading ? 'Carregando...' : 'Gerar Relatório'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={downloadCSV}
          disabled={!report || loading}
        >
          <Download className="w-4 h-4" />
          CSV
        </Button>
      </div>

      {/* Relatório */}
      {report && (
        <div className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
          {/* Cabeçalho */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-bold">Relatório Executivo Semanal</h3>
            <p className="text-sm text-gray-600">
              Período: {report.period.weekStart} a {report.period.weekEnd}
            </p>
          </div>

          {/* Resumo Geral */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
              <p className="text-sm text-gray-700">Receita Total</p>
              <p className="text-2xl font-bold">R$ {report.summary.totalRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
              <p className="text-sm text-gray-700">Total de Pedidos</p>
              <p className="text-2xl font-bold">{report.summary.totalOrders}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
              <p className="text-sm text-gray-700">Taxa de Conversão</p>
              <p className="text-2xl font-bold">{report.summary.conversionRate.toFixed(2)}%</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
              <p className="text-sm text-gray-700">Abandono de Carrinho</p>
              <p className="text-2xl font-bold">{report.summary.cartAbandonRate.toFixed(2)}%</p>
            </div>
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-lg">
              <p className="text-sm text-gray-700">Ticket Médio</p>
              <p className="text-2xl font-bold">R$ {report.summary.averageOrderValue.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Top 5 Categorias */}
          <div>
            <h4 className="font-bold text-md mb-3">Top 5 Categorias</h4>
            <div className="rounded-lg border border-gray-200 bg-white">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.topCategories.map((cat, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{cat.category}</TableCell>
                      <TableCell className="text-right">R$ {cat.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{cat.orders}</TableCell>
                      <TableCell className="text-right">{cat.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Top 8 Termos de Busca */}
          <div>
            <h4 className="font-bold text-md mb-3">Top 8 Termos de Busca</h4>
            <div className="rounded-lg border border-gray-200 bg-white">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Termo</TableHead>
                    <TableHead className="text-right">Buscas</TableHead>
                    <TableHead className="text-right">Resultados</TableHead>
                    <TableHead className="text-right">Sem Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.topSearchTerms.map((term, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{term.term}</TableCell>
                      <TableCell className="text-right">{term.count}</TableCell>
                      <TableCell className="text-right">{term.results}</TableCell>
                      <TableCell className="text-right">
                        {term.noResultRate > 0 ? (
                          <Badge variant="destructive">Sim</Badge>
                        ) : (
                          <Badge variant="secondary">Não</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Gaps de Catálogo */}
          {report.catalogGaps.length > 0 && (
            <div>
              <h4 className="font-bold text-md mb-3">Gaps de Catálogo</h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <ul className="list-disc list-inside space-y-2">
                  {report.catalogGaps.map((gap, idx) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">{gap.term}</span> ({gap.searchCount} buscas)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Recomendações */}
          {report.recommendations.length > 0 && (
            <div>
              <h4 className="font-bold text-md mb-3">Recomendações</h4>
              <div className="space-y-2">
                {report.recommendations.map((rec, idx) => (
                  <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
