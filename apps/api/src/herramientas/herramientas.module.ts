import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { HerramientasController } from './herramientas.controller';
import { HerramientasService } from './herramientas.service';

@Module({
  imports: [StorageModule],
  controllers: [HerramientasController],
  providers: [HerramientasService],
})
export class HerramientasModule {}
