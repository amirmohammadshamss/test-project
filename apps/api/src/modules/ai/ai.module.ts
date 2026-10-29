import {
  AnalysisController,
  AnalysisService,
  AnalysisRepository,
  PrismaAnalysisRepository,
} from './analysis';
import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiRepository } from './application';
import { PrismaAiRepository } from './repository';
import { AiService } from './ai.service';
@Module({
  controllers: [AiController, AnalysisController],
  providers: [
    AiService,
    AnalysisService,
    { provide: AnalysisRepository, useClass: PrismaAnalysisRepository },
    { provide: AiRepository, useClass: PrismaAiRepository },
  ],
})
export class AiModule {}
