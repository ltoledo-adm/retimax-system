import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { IntervencionesController } from './intervenciones.controller';
import { IntervencionesService } from './intervenciones.service';

@Module({
  imports: [StorageModule],
  controllers: [IntervencionesController],
  providers: [IntervencionesService],
  exports: [IntervencionesService],
})
export class IntervencionesModule {}
