import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

describe('HTTP API integration', () => {
  const app = createApp();
  it('serves liveness and OpenAPI', async () => {
    await request(app)
      .get('/health')
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('ok'));
    await request(app)
      .get('/openapi.json')
      .expect(200)
      .expect(({ body }) => expect(body.openapi).toBe('3.1.0'));
  });

  it('rejects malformed registration and protects private routes', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'bad', password: 'short', role: 'ROOT', fullName: '' })
      .expect(400);
    await request(app).get('/api/v1/users/me').expect(401);
    await request(app).get('/api/v1/admin/analytics').expect(401);
  });
});
