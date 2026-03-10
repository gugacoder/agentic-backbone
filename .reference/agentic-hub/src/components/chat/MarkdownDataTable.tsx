import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Table2, LayoutGrid, Copy, Check, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

interface MarkdownDataTableProps {
  children?: ReactNode
  [key: string]: unknown
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (typeof node === 'object' && 'props' in node) {
    return extractText((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

function extractTableData(children: ReactNode): { headers: string[]; rows: string[][] } {
  const headers: string[] = []
  const rows: string[][] = []

  const childArray = Array.isArray(children) ? children : [children]

  for (const child of childArray) {
    if (!child || typeof child !== 'object' || !('props' in child)) continue
    const el = child as { type?: string; props: { children?: ReactNode } }
    const tag = typeof el.type === 'string' ? el.type : ''

    if (tag === 'thead') {
      const trChildren = Array.isArray(el.props.children) ? el.props.children : [el.props.children]
      for (const tr of trChildren) {
        if (!tr || typeof tr !== 'object' || !('props' in tr)) continue
        const thChildren = Array.isArray((tr as { props: { children?: ReactNode } }).props.children)
          ? (tr as { props: { children?: ReactNode } }).props.children as ReactNode[]
          : [(tr as { props: { children?: ReactNode } }).props.children]
        for (const th of thChildren) {
          headers.push(extractText(th))
        }
      }
    }

    if (tag === 'tbody') {
      const trChildren = Array.isArray(el.props.children) ? el.props.children : [el.props.children]
      for (const tr of trChildren) {
        if (!tr || typeof tr !== 'object' || !('props' in tr)) continue
        const tdChildren = Array.isArray((tr as { props: { children?: ReactNode } }).props.children)
          ? (tr as { props: { children?: ReactNode } }).props.children as ReactNode[]
          : [(tr as { props: { children?: ReactNode } }).props.children]
        const row: string[] = []
        for (const td of tdChildren) {
          row.push(extractText(td))
        }
        rows.push(row)
      }
    }
  }

  return { headers, rows }
}

export function MarkdownDataTable({ children }: MarkdownDataTableProps) {
  const [filter, setFilter] = useState('')
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [copied, setCopied] = useState(false)

  const { headers, rows } = useMemo(() => extractTableData(children), [children])

  const filteredRows = useMemo(() => {
    if (!filter) return rows
    const lower = filter.toLowerCase()
    return rows.filter(row => row.some(cell => cell.toLowerCase().includes(lower)))
  }, [rows, filter])

  const sortedRows = useMemo(() => {
    if (sortCol === null) return filteredRows
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortCol] ?? ''
      const valB = b[sortCol] ?? ''
      const cmp = valA.localeCompare(valB, 'pt-BR', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredRows, sortCol, sortDir])

  const handleSort = useCallback((col: number) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }, [sortCol])

  const handleCopyCsv = useCallback(() => {
    const csv = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n')
    navigator.clipboard.writeText(csv)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [headers, rows])

  const SortIcon = ({ col }: { col: number }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 ml-1 inline" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 inline" />
      : <ArrowDown className="w-3 h-3 ml-1 inline" />
  }

  return (
    <div className="not-prose my-2">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filtrar..."
            className="h-8 text-xs pl-8"
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode(prev => prev === 'table' ? 'cards' : 'table')}
            aria-label={viewMode === 'table' ? 'Modo cards' : 'Modo tabela'}
          >
            {viewMode === 'table' ? <LayoutGrid className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopyCsv}
            aria-label="Copiar CSV"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Table view — uses shadcn Table components */}
      {viewMode === 'table' ? (
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              {headers.map((h, i) => (
                <TableHead
                  key={i}
                  className="cursor-pointer select-none"
                  onClick={() => handleSort(i)}
                >
                  {h}
                  <SortIcon col={i} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, ri) => (
              <TableRow key={ri}>
                {row.map((cell, ci) => (
                  <TableCell key={ci}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
            {sortedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center text-muted-foreground">
                  Nenhum resultado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      ) : (
        /* Card view */
        <div className="grid gap-2">
          {sortedRows.map((row, ri) => (
            <Card key={ri} className="shadow-sm">
              <CardContent className="p-3">
                <dl className="grid gap-1 text-xs">
                  {headers.map((h, ci) => (
                    <div key={ci} className="flex gap-2">
                      <dt className="font-medium text-muted-foreground shrink-0">{h}:</dt>
                      <dd>{row[ci]}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
          {sortedRows.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-4">
              Nenhum resultado
            </p>
          )}
        </div>
      )}
    </div>
  )
}
