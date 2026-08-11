import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import headquartersRouter from './headquarters';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';

let app: express.Express;

const headquarters = {
  name: 'Operations HQ',
  description: 'Primary operations office',
  address: '1 Supply Way',
  contactPerson: 'Morgan Lee',
  email: 'morgan@operations.test',
  phone: '555-3000',
  city: 'Seattle',
  country: 'US',
  floorCount: 4,
  capacity: 200,
};

describe('Headquarters API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    const db = await getDatabase();
    await db.run(
      'INSERT INTO headquarters (headquarters_id, name, description, address, contact_person, email, phone, city, country, floor_count, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [1, headquarters.name, headquarters.description, headquarters.address, headquarters.contactPerson, headquarters.email, headquarters.phone, headquarters.city, headquarters.country, headquarters.floorCount, headquarters.capacity],
    );
    app = express();
    app.use(express.json());
    app.use('/headquarters', headquartersRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('lists and gets headquarters', async () => {
    const list = await request(app).get('/headquarters');
    expect(list.status).toBe(200);
    expect(list.body[0]).toMatchObject({ headquartersId: 1, name: headquarters.name, city: 'Seattle' });

    const get = await request(app).get('/headquarters/1');
    expect(get.status).toBe(200);
    expect(get.body.capacity).toBe(200);
  });

  it('calculates metrics and formats the location label', async () => {
    const metrics = await request(app).get('/headquarters/1/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.body).toEqual({ score: 205, average: 2.5, display: 'HQ-14' });

    const label = await request(app).get('/headquarters/1/label');
    expect(label.status).toBe(200);
    expect(label.body.label).toBe('Location:Operations HQCity:SeattleCountry:US');
  });

  it('returns 404 for missing headquarters and metrics', async () => {
    expect((await request(app).get('/headquarters/999')).status).toBe(404);
    expect((await request(app).get('/headquarters/999/metrics')).status).toBe(404);
    expect((await request(app).get('/headquarters/999/label')).status).toBe(404);
    expect((await request(app).put('/headquarters/999').send(headquarters)).status).toBe(404);
    expect((await request(app).delete('/headquarters/999')).status).toBe(404);
  });

  it('creates headquarters successfully but exposes the update validator bug', async () => {
    const create = await request(app).post('/headquarters').send(headquarters);
    expect(create.status).toBe(201);
    expect(create.body).toMatchObject(headquarters);

    const update = await request(app).put('/headquarters/1').send({ name: 'Updated HQ', address: '2 Supply Way' });
    expect(update.status).toBe(500);
    expect(update.body.error.code).toBe('INTERNAL_ERROR');
  });
});
