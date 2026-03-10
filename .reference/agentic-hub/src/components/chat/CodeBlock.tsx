import { useState, useCallback, type ReactNode } from 'react'
import { Copy, Check } from 'lucide-react'

interface CodeBlockProps {
  children?: ReactNode
  className?: string
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

export function CodeBlock({ children, ...props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  // The direct child of <pre> is a <code> element from ReactMarkdown
  const codeChild = Array.isArray(children) ? children[0] : children
  const codeProps = (codeChild && typeof codeChild === 'object' && 'props' in codeChild)
    ? (codeChild as { props: { className?: string; children?: ReactNode } }).props
    : null

  const language = codeProps?.className?.replace('language-', '') ?? null
  const text = extractText(children)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])

  return (
    <div className="relative rounded-md bg-muted p-3 overflow-x-auto text-xs font-mono" {...props}>
      {/* Language badge + Copy button toolbar */}
      <div className="flex items-center justify-between mb-2">
        {language ? (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {language}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copiar código"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      {/* Render original children (the <code> element) */}
      {children}
    </div>
  )
}
