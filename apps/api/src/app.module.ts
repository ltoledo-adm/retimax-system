import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { CatalogoModule } from './catalogo/catalogo.module';
import { ComercialModule } from './comercial/comercial.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { HerramientasModule } from './herramientas/herramientas.module';
import { IntervencionesModule } from './intervenciones/intervenciones.module';
import { MaquinasModule } from './maquinas/maquinas.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportesModule } from './reportes/reportes.module';
import { StorageModule } from './storage/storage.module';
import { resolveUploadDir } from './storage/upload-path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '../../../.env'),
        join(__dirname, '../.env'),
        '.env',
      ],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          rootPath: resolveUploadDir(config),
          serveRoot: '/uploads',
        },
      ],
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    MaquinasModule,
    CatalogoModule,
    ComercialModule,
    ReportesModule,
    EmpleadosModule,
    IntervencionesModule,
    HerramientasModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
