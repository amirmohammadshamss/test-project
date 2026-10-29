import type { Actor } from '../../../../../packages/shared/src/contracts';
import type { DraftValue } from '../../../../../packages/shared/src/contracts';
type DraftDto = { input: string };
type ApproveDto = DraftValue;
export abstract class AiRepository {
  abstract request(
    actor: Actor,
    input: DraftDto,
    key: string,
  ): Promise<unknown>;
  abstract get(actor: Actor, id: string): Promise<unknown>;
  abstract list(actor: Actor): Promise<unknown>;
  abstract metrics(actor: Actor): Promise<unknown>;
  abstract approve(
    actor: Actor,
    id: string,
    input: ApproveDto,
    key: string,
  ): Promise<unknown>;
}
