import { readFileSync } from 'node:fs';
import { configuredManagerPlanner } from '../apps/worker/src/provider';
import type { ManagerPlan } from '../packages/shared/src/manager-analysis';
async function main() {
  if (
    process.env.AI_EVAL_CONFIRM !== '1' ||
    !['ollama', 'openai', 'avalai'].includes(process.env.AI_PROVIDER || '')
  )
    throw new Error('Explicit provider and evaluation opt-in required');
  const cases = JSON.parse(
    readFileSync('scripts/fixtures/persian-manager-evaluation.json', 'utf8'),
  ) as { question: string; expected?: ManagerPlan; unsupported?: boolean }[];
  const planner = configuredManagerPlanner();
  let matched = 0,
    errors = 0,
    inputTokens = 0,
    outputTokens = 0;
  const start = Date.now();
  for (const test of cases) {
    try {
      const plan = await planner.plan(test.question, (u) => {
        inputTokens += u.inputTokens || 0;
        outputTokens += u.outputTokens || 0;
      });
      if (
        test.unsupported
          ? plan.tool === 'UNSUPPORTED'
          : plan.tool === test.expected?.tool &&
            plan.period === test.expected?.period
      )
        matched++;
    } catch {
      errors++;
    }
  }
  console.log(
    JSON.stringify(
      {
        cases: cases.length,
        matched,
        providerErrors: errors,
        elapsedMs: Date.now() - start,
        reportedInputTokens: inputTokens,
        reportedOutputTokens: outputTokens,
        billedCost: null,
      },
      null,
      2,
    ),
  );
  if (matched !== cases.length || errors) process.exitCode = 1;
}
void main().catch(() => {
  console.error(
    'MANAGER_EVALUATION_NOT_COMPLETED: configure eligible provider and explicit AI_EVAL_CONFIRM=1. No secrets logged.',
  );
  process.exitCode = 1;
});
