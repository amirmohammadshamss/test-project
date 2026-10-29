import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../packages/shared/src/contracts';
import { ApproveDto, DraftDto } from '../../common/dto';
import { AiRepository } from './application';
@Injectable()
export class AiService {
  constructor(
    @Inject(AiRepository) private readonly repository: AiRepository,
  ) {}
  request(actor: Actor, input: DraftDto, key: string) {
    return this.repository.request(actor, input, key);
  }
  get(actor: Actor, id: string) {
    return this.repository.get(actor, id);
  }
  list(actor: Actor) {
    return this.repository.list(actor);
  }
  metrics(actor: Actor) {
    return this.repository.metrics(actor);
  }
  approve(actor: Actor, id: string, input: ApproveDto, key: string) {
    return this.repository.approve(actor, id, input, key);
  }
}
