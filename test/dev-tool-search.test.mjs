import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, name } from '../preset/anchored-standard-windows/dev-tool-search.mjs'

function register(schemas = []) {
  const registered = []
  const schemaScopes = []
  const ctx = {
    tools: {
      schemas(scope) {
        schemaScopes.push(scope)
        return schemas
      },
      register(tool) {
        registered.push(tool)
      },
    },
  }
  apply(ctx)
  return { registered, ctx, schemaScopes }
}

const exec = (args) => ({ agent: { session: { id: 's', header: {} } }, signal: undefined, ...args })

test('exports a diagnostic plugin name', () => {
  assert.equal(name, 'dev-tool-search')
})

test('registers the dev_tool_search tool with an unlock capability index', () => {
  const { registered } = register()
  const tool = registered.find((t) => t.name === 'dev_tool_search')
  assert.ok(tool)
  assert.match(tool.description, /web_search/)
  assert.match(tool.description, /subagent/)
  assert.ok(tool.parameters.properties.query)
  assert.ok(tool.parameters.properties.toolNames)
  assert.ok(tool.output.schema)
})

test('search returns matching tool names with descriptions', async () => {
  const { registered, schemaScopes } = register([
    { name: 'web_search', description: 'internet search' },
    { name: 'bash', description: 'run commands' },
    { name: 'subagent', description: 'delegate work' },
  ])
  const tool = registered.find((t) => t.name === 'dev_tool_search')
  const execution = exec()
  const result = await tool.execute({ query: 'search internet' }, execution)
  assert.equal(schemaScopes[0], execution.agent)
  assert.match(result.text, /web_search/)
  assert.doesNotMatch(result.text, /bash/)
  assert.doesNotMatch(result.text, /subagent/)
})

test('Issue #24: agent-scoped pwsh is visible to keyword search', async () => {
  const { registered } = register([{ name: 'pwsh', description: 'Execute a PowerShell command' }])
  const tool = registered.find((t) => t.name === 'dev_tool_search')
  const result = await tool.execute({ query: 'pwsh' }, exec())
  assert.match(result.text, /pwsh/)
})

test('no match reports so and still hints at unlocking', async () => {
  const { registered } = register([{ name: 'bash', description: 'run commands' }])
  const tool = registered.find((t) => t.name === 'dev_tool_search')
  const result = await tool.execute({ query: 'zzz-nothing' }, exec())
  assert.match(result.text, /No tools match/)
})

test('unlock names are echoed back (the bootstrap records them from tool/call events)', async () => {
  const { registered } = register([{ name: 'web_search', description: 'internet search' }])
  const tool = registered.find((t) => t.name === 'dev_tool_search')
  const result = await tool.execute({ toolNames: ['web_search'] }, exec())
  assert.match(result.text, /Unlocked for the next request: web_search/)
})

test('empty query and empty toolNames asks for input', async () => {
  const { registered } = register([])
  const tool = registered.find((t) => t.name === 'dev_tool_search')
  const result = await tool.execute({}, exec())
  assert.match(result.text, /Provide `query`/)
})

test('a throwing catalog search degrades to a message, never throws', async () => {
  const spy = { tools: { schemas() { throw new Error('registry unavailable') }, register(t) { this.registered = t } } }
  apply(spy)
  const result = await spy.tools.registered.execute({ query: 'web' }, exec())
  assert.match(result.text, /catalog search unavailable/)
})
