import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import { MermaidBlock } from './MermaidBlock'
import { CodeBlock } from './CodeBlock'
import { useAppStore } from '@/store'
import 'katex/dist/katex.min.css'

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'details', 'summary', 'kbd', 'sub', 'sup', 'ins'],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'id', 'className'],
  },
}

interface MarkdownRendererProps {
  content: string
  className?: string
  allowHtml?: boolean
  enableMermaid?: boolean
  enableMath?: boolean
  /** Override or extend the default react-markdown component map */
  components?: Components
  /** Extra remark plugins appended after the defaults */
  remarkPlugins?: any[]
  /** Extra rehype plugins appended after the defaults */
  rehypePlugins?: any[]
}

export function MarkdownRenderer({
  content,
  className = '',
  allowHtml = false,
  enableMermaid = true,
  enableMath = true,
  components: componentOverrides,
  remarkPlugins: extraRemarkPlugins,
  rehypePlugins: extraRehypePlugins,
}: MarkdownRendererProps) {
  const theme = useAppStore((s) => s.theme)

  const remarkPlugins: any[] = [remarkGfm, remarkBreaks]
  if (enableMath) remarkPlugins.push(remarkMath)
  if (extraRemarkPlugins) remarkPlugins.push(...extraRemarkPlugins)

  const rehypePlugins: any[] = [rehypeHighlight, rehypeSlug]
  if (enableMath) rehypePlugins.push(rehypeKatex)
  if (!allowHtml) rehypePlugins.push([rehypeSanitize, sanitizeSchema])
  if (extraRehypePlugins) rehypePlugins.push(...extraRehypePlugins)

  const defaultComponents: Components = {
    pre({ children, ...props }) {
      return <pre className="relative" {...props}>{children}</pre>
    },
    code({ children, className: cls, node, ...props }: any) {
      const match = /language-(\w+)/.exec(cls ?? '')
      const language = match?.[1] ?? ''
      const isInline = !node?.position || !cls

      if (isInline) {
        return <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>{children}</code>
      }

      if (enableMermaid && language === 'mermaid') {
        return <MermaidBlock code={String(children).trim()} theme={theme} />
      }

      return (
        <CodeBlock className={cls} {...props}>
          {children}
        </CodeBlock>
      )
    },
  }

  const mergedComponents: Components = componentOverrides
    ? { ...defaultComponents, ...componentOverrides }
    : defaultComponents

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={mergedComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
