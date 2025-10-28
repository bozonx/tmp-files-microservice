import { Test, TestingModule } from '@nestjs/testing';
import { TerminusModule, HealthCheckService } from '@nestjs/terminus';
import { HealthController } from '@/modules/health/health.controller';

describe('HealthController (unit)', () => {
  let controller: HealthController;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get<HealthController>(HealthController);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /health returns service up', async () => {
    const res = await controller.check();
    expect(res.status).toBe('ok');
    expect(res.details).toHaveProperty('service');
    expect(res.details.service.status).toBe('up');
  });

  it('GET /health/ready returns ready up', async () => {
    const res = await controller.ready();
    expect(res.status).toBe('ok');
    expect(res.details).toHaveProperty('ready');
    expect(res.details.ready.status).toBe('up');
  });

  it('GET /health/live returns uptime metric', async () => {
    const res = await controller.live();
    expect(res.status).toBe('ok');
    expect(res.details).toHaveProperty('uptime');
    expect(typeof res.details.uptime.uptime).toBe('number');
  });
});
