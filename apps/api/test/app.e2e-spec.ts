import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('RETIMAX E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let proveedorId: string;
  let maquinaId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash('Test1234!', 12);
    await prisma.refreshToken.deleteMany();
    await prisma.ventaHerramienta.deleteMany();
    await prisma.herramienta.deleteMany();
    await prisma.intervencion.deleteMany();
    await prisma.imagenMaquina.deleteMany();
    await prisma.venta.deleteMany();
    await prisma.pedido.deleteMany();
    await prisma.maquina.deleteMany();
    await prisma.proveedor.deleteMany();
    await prisma.cliente.deleteMany();
    await prisma.usuario.deleteMany();

    await prisma.usuario.create({
      data: {
        nombre: 'Test Admin',
        email: 'test@retimax.local',
        username: 'testadmin',
        passwordHash,
        rol: 'ADMIN',
      },
    });

    const proveedor = await prisma.proveedor.create({
      data: { nombre: 'Proveedor E2E' },
    });
    proveedorId = proveedor.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('login and obtain tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'testadmin', password: 'Test1234!' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    accessToken = res.body.accessToken;
  });

  it('creates a machine', async () => {
    const res = await request(app.getHttpServer())
      .post('/maquinas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        nombre: 'Torno CNC E2E',
        tipo: 'Torno',
        marca: 'Mazak',
        modelo: 'QT200',
        anio: 2018,
        proveedorId,
        precioCompraUsd: '12000.00',
        descripcionLlegada: 'Comprado con accesorios',
      })
      .expect(201);

    expect(res.body.estado).toBe('COMPRADA_ITALIA');
    maquinaId = res.body.id;
  });

  it('transitions machine states through workflow', async () => {
    const transitions = [
      'EN_TRANSITO',
      'RECIBIDA',
      'EN_DIAGNOSTICO',
      'EN_MANTENIMIENTO',
      'LISTA_PARA_VENTA',
    ] as const;

    for (const estado of transitions) {
      const res = await request(app.getHttpServer())
        .patch(`/maquinas/${maquinaId}/estado`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ estado })
        .expect(200);

      expect(res.body.estado).toBe(estado);
    }
  });

  it('rejects invalid state transition', async () => {
    await request(app.getHttpServer())
      .patch(`/maquinas/${maquinaId}/estado`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ estado: 'COMPRADA_ITALIA' })
      .expect(400);
  });

  it('creates immutable interventions audit trail', async () => {
    const diagnostico = await request(app.getHttpServer())
      .post(`/maquinas/${maquinaId}/intervenciones`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tipo: 'DIAGNOSTICO_INICIAL',
        area: 'MECANICA',
        descripcion: 'Rodamiento dañado detectado al llegar',
        responsable: 'Juan Mecánico',
      })
      .expect(201);

    const trabajo = await request(app.getHttpServer())
      .post(`/maquinas/${maquinaId}/intervenciones`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tipo: 'TRABAJO_REALIZADO',
        area: 'MECANICA',
        descripcion: 'Rodamiento reemplazado y lubricado',
        responsable: 'Juan Mecánico',
      })
      .expect(201);

    const correccion = await request(app.getHttpServer())
      .post(`/maquinas/${maquinaId}/intervenciones`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tipo: 'OBSERVACION_ADICIONAL',
        area: 'MECANICA',
        descripcion: 'Corrección: también se revisó el eje auxiliar',
        responsable: 'Juan Mecánico',
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/maquinas/${maquinaId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(detail.body.intervenciones).toHaveLength(3);
    expect(detail.body.intervenciones[0].id).toBe(diagnostico.body.id);
    expect(detail.body.intervenciones[1].id).toBe(trabajo.body.id);
    expect(detail.body.intervenciones[2].id).toBe(correccion.body.id);
    expect(detail.body.intervenciones[0].registradoPor.email).toBe('test@retimax.local');
  });
});
