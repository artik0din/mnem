#!/usr/bin/env node
import { buildProgram } from './program.js'

async function main(): Promise<void> {
  const program = buildProgram()
  try {
    await program.parseAsync(process.argv)
  } catch (err) {
    if (isCommanderError(err)) {
      // commander already printed its own message
      process.exit(err.exitCode ?? 1)
    }
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`mnem: ${message}\n`)
    process.exit(1)
  }
}

function isCommanderError(err: unknown): err is { exitCode?: number; code?: string } {
  return typeof err === 'object' && err !== null && 'code' in err
}

void main()
