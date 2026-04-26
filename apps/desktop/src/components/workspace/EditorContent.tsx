import Editor from '@monaco-editor/react'
import { useAppStore } from '@/store'
import { useEffect, useRef } from 'react'
import type { OpenFile } from '@/store/types'
import { fetchProjectFileContent } from '@/lib/orchestra-client'

interface EditorContentProps {
  file: OpenFile
}

export function EditorContent({ file }: EditorContentProps) {
  const setFileContent = useAppStore((s) => s.setFileContent)
  const setFileDirty = useAppStore((s) => s.setFileDirty)
  const theme = useAppStore((s) => s.theme)
  const config = useAppStore((s) => s.config)
  const projects = useAppStore((s) => s.projects)

  const originalContentRef = useRef<string>('')

  // Load file content when file changes
  useEffect(() => {
    if (file.content !== null) return
    let cancelled = false
    const load = async () => {
      // Try HTTP API first — find which project contains this file
      const project = projects.find((p) => file.filePath.startsWith(p.root_path))
      if (project && config) {
        try {
          const relativePath = file.filePath.slice(project.root_path.length + 1)
          const content = await fetchProjectFileContent(config, project.id, relativePath)
          if (cancelled) return
          setFileContent(file.id, content)
          originalContentRef.current = content
          return
        } catch (err) {
          if (cancelled) return
          const msg = err instanceof Error ? err.message : String(err)
          setFileContent(file.id, `// Error loading file via HTTP API: ${msg}\n// File: ${file.filePath}`)
          return
        }
      }

      // Fallback: try Electron IPC (works when running inside Electron without a matching project)
      try {
        if (window.orchestraDesktop?.fs?.readFile) {
          const result = await window.orchestraDesktop.fs.readFile(file.filePath)
          if (cancelled) return
          if (result.isBinary) {
            setFileContent(file.id, '// Binary file — cannot display')
          } else if (result.tooLarge) {
            setFileContent(file.id, '// File too large to display (>5MB)')
          } else {
            setFileContent(file.id, result.content)
            originalContentRef.current = result.content
          }
          return
        }
        // No project match and no IPC available
        if (!cancelled) {
          setFileContent(file.id, `// Cannot read file: no matching project found and Electron IPC not available\n// File: ${file.filePath}`)
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
