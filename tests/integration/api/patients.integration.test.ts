import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/patients/route';
import { createTestClinic, createTestPatient } from '../helpers/db';

const toNextRequest = (request: Request): NextRequest => request as unknown as NextRequest;

describe('GET /api/patients (integration)', () => {
  it('returns matching patient summaries from the database', async () => {
    const clinic = await createTestClinic();
    const patient = await createTestPatient(clinic.id, {
      firstName: 'Grace',
      lastName: 'Hopper',
      mrn: 'MRN-INTEGRATION-1',
    });

    const request = new Request(`http://localhost/api/patients?search=Grace`);
    const response = await GET(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.data[0]).toMatchObject({
      id: patient.id,
      firstName: 'Grace',
      lastName: 'Hopper',
      mrn: 'MRN-INTEGRATION-1',
    });
  });

  it('applies the limit parameter and reports hasMore correctly', async () => {
    const clinic = await createTestClinic({ name: 'Aggregation Fertility Center' });

    await Promise.all(
      Array.from({ length: 3 }).map((_, index) =>
        createTestPatient(clinic.id, {
          firstName: `Patient${index}`,
          lastName: 'Example',
          mrn: `MRN-LIMIT-${index}`,
        }),
      ),
    );

    const request = new Request('http://localhost/api/patients?limit=2');
    const response = await GET(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.hasMore).toBe(true);
  });
});
