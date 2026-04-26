import Editor from '@monaco-editor/react'
import { useAppStore } from '@/store'
import { useEffect, useRef } from 'react'
import type { OpenFile } from '@/store/types'

interface EditorContentProps {
  file: OpenFile
}

export function EditorContent({ file }: EditorContentProps) {
  const setFileContent = useAppStore((s) => s.setFileContent)
  const setFileDirty = useAppStore((s) => s.setFileDirty)
  const theme = useAppStore((s) => s.theme)
  const config = useAppStore((s) => s.config)

  const originalContentRef = useRef<string>('')

  // Load file content when file changes
  useEffect(() => {
    if (file.content !== null) return
    let cancelled = false
    const load = async () => {
      if (!config) {
        setFileContent(file.id, '// No backend connection configured')
        return
      }
      try {
        const url = `${config.baseUrl}/api/v1/workspace/file?path=${encodeURIComponent(file.filePath)}`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${config.apiToken}` },
        })
        if (!res.ok) {
          const errBody = await res.text().catch(() => res.statusText)
          if (!cancelled) setFileContent(file.id, `// Error ${res.status}: ${errBody}\n// File: ${file.filePath}`)
          return
        }
        const content = await res.text()
        if (!cancelled) {
          setFileContent(file.id, content)
          originalContentRef.current = content
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err)
          setFileContent(file.id, `// Error loading file: ${msg}\n// File: ${file.filePath}`)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id])

  // Update originalContentRef when switching to a file that's already loaded
  useEffect(() => {
    if (file.content !== null && file.content !== undefined && !file.isDirty) {
      originalContentRef.current = file.content
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id])

  // Save handler (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (file.isDirty && file.content !== null) {
          window.orchestraDesktop.fs
            .writeFile(file.filePath, file.content)
            .then(() => {
              setFileDirty(file.id, false)
              originalContentRef.current = file.content!
            })
            .catch(() => {})
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [file.id, file.isDirty, file.content, file.filePath, setFileDirty])

  if (file.content === null) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    )
  }

  return (
    <div className="h-full">
      <Editor
        key={file.id}
        language={file.language}
        value={file.content}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onChange={(value) => {
          if (value !== undefined) {
            setFileContent(file.id, value)
            setFileDirty(file.id, value !== originalContentRef.current)
          }
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  )
}
