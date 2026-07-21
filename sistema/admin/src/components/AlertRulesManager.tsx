import React, { useState, useEffect } from 'react'
import { AlertRule } from '../types/analytics'
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const METRIC_LABELS: Record<string, string> = {
  conversionRate: 'Taxa de Conversão (%)',
  cartAbandonRate: 'Abandono Carrinho (%)',
  revenue: 'Receita (R$)',
  orders: 'Quantidade de Pedidos',
  noResultRate: 'Taxa Sem Resultado (%)',
}

const OPERATOR_LABELS: Record<string, string> = {
  below: 'Abaixo de',
  above: 'Acima de',
  equals: 'Igual a',
}

const COMPARISON_LABELS: Record<string, string> = {
  absolute: 'Valor Absoluto',
  percentChange: '% de Mudança vs. Anterior',
}

interface AlertRulesManagerProps {
  apiUrl: string
  token: string
}

export function AlertRulesManager({ apiUrl, token }: AlertRulesManagerProps) {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [pendingDeleteRule, setPendingDeleteRule] = useState<AlertRule | null>(null)
  const [formData, setFormData] = useState({
    metric: 'conversionRate',
    comparisonType: 'absolute',
    threshold: 5,
    operator: 'below',
    description: '',
    enabled: true,
  })

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  useEffect(() => {
    loadRules()
  }, [])

  const loadRules = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/analytics/alert-rules`, { headers })
      if (res.ok) {
        const data = await res.json()
        setRules(data)
      }
    } catch (error) {
      console.error('Erro carregando regras:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const method = editingRule ? 'PATCH' : 'POST'
      const url = editingRule
        ? `${apiUrl}/analytics/alert-rules/${editingRule.id}`
        : `${apiUrl}/analytics/alert-rules`

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        await loadRules()
        setShowForm(false)
        setEditingRule(null)
        setFormData({
          metric: 'conversionRate',
          comparisonType: 'absolute',
          threshold: 5,
          operator: 'below',
          description: '',
          enabled: true,
        })
      }
    } catch (error) {
      console.error('Erro salvando regra:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (ruleId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/analytics/alert-rules/${ruleId}`, {
        method: 'DELETE',
        headers,
      })

      if (res.ok) {
        await loadRules()
        setPendingDeleteRule(null)
      }
    } catch (error) {
      console.error('Erro deletando regra:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule)
    setFormData({
      metric: rule.metric,
      comparisonType: rule.comparisonType,
      threshold: rule.threshold,
      operator: rule.operator,
      description: rule.description || '',
      enabled: rule.enabled,
    })
    setShowForm(true)
  }

  return (
    <Card className="mt-6 overflow-hidden border-[#ead7df] shadow-[0_18px_40px_rgba(93,8,42,0.08)]">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b bg-[linear-gradient(180deg,#fffafc_0%,#fff_100%)]">
        <CardTitle>Regras de Alerta</CardTitle>
        <Button
          type="button"
          onClick={() => {
            setEditingRule(null)
            setPendingDeleteRule(null)
            setFormData({
              metric: 'conversionRate',
              comparisonType: 'absolute',
              threshold: 5,
              operator: 'below',
              description: '',
              enabled: true,
            })
            setShowForm(!showForm)
          }}
        >
          <Plus size={18} />
          Nova Regra
        </Button>
      </CardHeader>

      <CardContent className="pt-4">
        {showForm && (
          <form onSubmit={handleCreateOrUpdate} className="mb-6 rounded-lg border bg-muted/35 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1 block">Métrica</Label>
              <Select
                value={formData.metric}
                onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
              >
                {Object.entries(METRIC_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label className="mb-1 block">Tipo Comparação</Label>
              <Select
                value={formData.comparisonType}
                onChange={(e) => setFormData({ ...formData, comparisonType: e.target.value })}
              >
                {Object.entries(COMPARISON_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label className="mb-1 block">Operador</Label>
              <Select
                value={formData.operator}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
              >
                {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label className="mb-1 block">Valor Limite</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
              />
            </div>

            <div className="md:col-span-2">
              <Label className="mb-1 block">Descrição (opcional)</Label>
              <Input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Alerta quando conversão cai abaixo de 5%"
              />
            </div>

            <div className="flex items-center gap-4 md:col-span-2">
              <Label className="flex items-center gap-2">
                <Checkbox checked={formData.enabled} onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })} />
                <span>Ativo</span>
              </Label>

              <div className="flex gap-2 ml-auto">
                <Button
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false)
                    setEditingRule(null)
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </form>
        )}

        {pendingDeleteRule && (
          <div className="mb-6 rounded-lg border border-red-100 bg-red-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-red-800">Excluir regra de alerta?</p>
                <p className="mt-1 text-sm text-red-700">
                  Esta ação remove a regra {pendingDeleteRule.description ? `"${pendingDeleteRule.description}"` : METRIC_LABELS[pendingDeleteRule.metric] || pendingDeleteRule.metric}.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingDeleteRule(null)}
                  className="border-red-200 bg-white text-red-700 hover:bg-red-50"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete(pendingDeleteRule.id)}
                  disabled={loading}
                >
                  {loading ? 'Excluindo...' : 'Excluir regra'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading && !showForm ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando regras...</div>
        ) : rules.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Nenhuma regra de alerta configurada</div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead>Comparação</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{METRIC_LABELS[rule.metric] || rule.metric}</TableCell>
                  <TableCell>{COMPARISON_LABELS[rule.comparisonType] || rule.comparisonType}</TableCell>
                  <TableCell>{OPERATOR_LABELS[rule.operator] || rule.operator}</TableCell>
                  <TableCell className="font-semibold">{rule.threshold}</TableCell>
                  <TableCell className="text-muted-foreground">{rule.description || '—'}</TableCell>
                  <TableCell>
                    {rule.enabled ? (
                      <Badge variant="success">
                        <Check size={14} /> Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <X size={14} /> Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(rule)}
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setShowForm(false)
                          setEditingRule(null)
                          setPendingDeleteRule(rule)
                        }}
                        title="Deletar"
                      >
                        <Trash2 className="text-destructive" size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
