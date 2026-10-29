import type { DraftValue } from './contracts';
/** Application boundary: no transport, ORM or AI SDK dependencies. */
export interface AiUsage {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}
export interface MenuParser {
  parse(input: string, usage?: (value: AiUsage) => void): Promise<DraftValue>;
}
export class PermanentFailure extends Error {}
