import {
  Cpu,
  Database,
  FileText,
  FolderTree,
  Globe,
  ListTodo,
  Settings2,
  Terminal,
} from 'lucide-react'
import type { SidebarItem } from '@/components/app-shell/types'

export const sidebarItems: SidebarItem[] = [
  {
    id: 'ISSUES',
    label: 'Tasks',
    description: 'Task board and inspector',
    icon: ListTodo,
  },
  {
    id: 'PROJECTS',
    label: 'Projects',
    description: 'Local workspace grouping',
    icon: FolderTree,
  },
  {
    id: 'CONSOLE',
    label: 'Live Console',
    description: 'Multi-agent terminal dock',
    icon: Terminal,
  },
  {
    id: 'AGENTS',
    label: 'Agents',
    description: 'Global agent configurations',
    icon: Cpu,
  },
  {
    id: 'WAREHOUSE',
    label: 'Analytics',
    description: 'Token usage and session archives',
    icon: Database,
  },
  {
    id: 'SANDBOX',
    label: 'Sandbox',
    description: 'Remote code execution via unsandbox',
    icon: Globe,
  },
  {
    id: 'SETTINGS',
    label: 'Settings',
    description: 'Backend and migration controls',
    icon: Settings2,
  },
  {
    id: 'DOCS',
    label: 'Documentation',
    description: 'User & engineering guides',
    icon: FileText,
  },
]

export type SectionID =
  | 'DASHBOARD'
  | 'RUNNING'
  | 'ISSUES'
  | 'PROJECTS'
  | 'AGENTS'
  | 'WAREHOUSE'
  | 'SANDBOX'
  | 'SETTINGS'
  | 'DOCS'
  | 'CONSOLE'

const SECTION_IDS: readonly SectionID[] = [
  'DASHBOARD',
  'RUNNING',
  'ISSUES',
  'PROJECTS',
  'AGENTS',
  'WAREHOUSE',
  'SANDBOX',
  'SETTINGS',
  'DOCS',
  'CONSOLE',
]

export function isSectionID(value: string): value is SectionID {
  return (SECTION_IDS as readonly string[]).includes(value)
}

export type SectionVisibility = {
  showDashboard: boolean
  showRunning: boolean
  showIssueBoard: boolean
  showProjects: boolean
  showAgents: boolean
  showWarehouse: boolean
  showSandbox: boolean
  showSettings: boolean
  showDocs: boolean
  showConsole: boolean
}

const sectionMeta: Record<SectionID, { label: string; title: string }> = {
  DASHBOARD: { label: 'Operations', title: 'Dashboard' },
  RUNNING: { label: 'Operations', title: 'Running' },
  ISSUES: { label: 'Tracker', title: 'Tasks' },
  PROJECTS: { label: 'Workspace', title: 'Projects' },
  AGENTS: { label: 'Compute', title: 'Agents' },
  WAREHOUSE: { label: 'Analytics', title: 'Analytics' },
  SANDBOX: { label: 'Compute', title: 'Sandbox' },
  SETTINGS: { label: 'System', title: 'Settings' },
  DOCS: { label: 'Knowledge', title: 'Documentation' },
  CONSOLE: { label: 'Runtime', title: 'Live Console' },
}

export function getSectionVisibility(activeSection: SectionID): SectionVisibility {
  return {
    showDashboard: activeSection === 'DASHBOARD',
    showRunning: activeSection === 'RUNNING',
    showIssueBoard: activeSection === 'ISSUES',
    showProjects: activeSection === 'PROJECTS',
    showAgents: activeSection === 'AGENTS',
    showWarehouse: activeSection === 'WAREHOUSE',
    showSandbox: activeSection === 'SANDBOX',
    showSettings: activeSection === 'SETTINGS',
    showDocs: activeSection === 'DOCS',
    showConsole: activeSection === 'CONSOLE',
  }
}

export function getCurrentSectionMeta(activeSection: SectionID): { label: string; title: string } {
  return sectionMeta[activeSection] ?? sectionMeta.ISSUES
}
