import {
  AnalysisController,
  AnalysisService,
  AnalysisRepository,
  PrismaAnalysisRepository,
} from './analysis';
import { Module } from '@nestjs/common';
@Module({
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    { provide: AnalysisRepository, useClass: PrismaAnalysisRepository },
  ],
})
export class AiModule {}
