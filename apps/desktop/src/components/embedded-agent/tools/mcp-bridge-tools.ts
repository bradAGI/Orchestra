import { tool } from 'ai'
import { z } from 'zod'
import type { BackendConfig } from '@/lib/orchestra-client'
import { fetchMCPServers, fetchMCPTools } from '@/lib/orchestra-client'

/**
 * Creates MCP bridge tools that enable cross-server tool discovery
 * and chaining. Tools from all connected MCP servers are aggregated
 * with namespace prefixes (serverName.toolName) to prevent conflicts.
 */
export function createMCPBridgeTools(config: BackendConfig) {
  return {
    list_mcp_servers: tool({
      description: 'List all connected MCP servers and their status.',
      inputSchema: z.object({}),
      execute: async () => {
        const servers = await fetchMCPServers(config)
        return {
          servers: servers.map((s) => ({
            id: s.id,
            name: s.name,
            command: s.command,
          })),
          count: servers.length,
        }
      },
    }),

    discover_mcp_tools: tool({
      description: 'Discover all tools exposed by connected MCP servers. Tools are namespaced as serverName.toolName to avoid conflicts.',
      inputSchema: z.object({
        server_name: z.string().optional().describe('Optional filter by server name'),
      }),
      execute: async (params) => {
        const [servers, tools] = await Promise.all([
          fetchMCPServers(config),
          fetchMCPTools(config),
        ])

        const serverMap = new Map(servers.map((s) => [s.id, s.name]))

        const namespacedTools = tools.map((t) => {
          const serverName = serverMap.get((t as Record<string, unknown>).server_id as string || '') || 'unknown'
          return {
            namespace: `${serverName}.${t.name}`,
            name: t.name,
            server: serverName,
            ...t,
          }
        })

        const filtered = params.server_name
          ? namespacedTools.filter((t) => t.server.toLowerCase() === params.server_name!.toLowerCase())
          : namespacedTools

        return { tools: filtered, count: filtered.length }
      },
    }),

    mcp_server_status: tool({
      description: 'Check the connection status of all MCP servers. Shows which servers are available and which tools they expose.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const [servers, tools] = await Promise.all([
            fetchMCPServers(config),
            fetchMCPTools(config),
          ])

          const toolsByServer = new Map<string, string[]>()
          for (const t of tools) {
            const serverId = (t as Record<string, unknown>).server_id as string || 'unknown'
            const list = toolsByServer.get(serverId) || []
            list.push(t.name)
            toolsByServer.set(serverId, list)
          }

          const status = servers.map((s) => ({
            name: s.name,
            id: s.id,
            tools: toolsByServer.get(s.id || '') || [],
            tool_count: (toolsByServer.get(s.id || '') || []).length,
          }))

          return {
            servers: status,
            total_servers: servers.length,
            total_tools: tools.length,
          }
        } catch (err) {
          return {
            servers: [],
            total_servers: 0,
            total_tools: 0,
            error: err instanceof Error ? err.message : 'failed to check MCP status',
          }
        }
      },
    }),
  }
}
