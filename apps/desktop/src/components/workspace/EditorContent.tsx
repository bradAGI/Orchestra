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

  const originalContentRef = useRef<string>('')

  // Track original content for dirty detection
  useEffect(() => {
    if (file.content !== null && !file.isDirty) {
      originalContentRef.current = file.content
    }
  }, [file.id, file.content, file.isDirty])

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
