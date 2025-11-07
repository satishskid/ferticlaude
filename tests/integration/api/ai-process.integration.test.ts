import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/ai/process/route';
import { createTestClinic, createTestPatient, createPredictionForPatient } from '../helpers/db';

const toNextRequest = (request: Request): NextRequest => request as unknown as NextRequest;

describe('GET /api/ai/process (integration)', () => {
  it('returns patient AI history from the database', async () => {
    const clinic = await createTestClinic();
    const patient = await createTestPatient(clinic.id, {
      firstName: 'Integration',
      lastName: 'Patient',
      mrn: 'MRN-INT-HISTORY',
    });

    await createPredictionForPatient(patient.id, {
      output: 'Integration test treatment plan.',
      modelVersion: 'llama-3.3-70b-versatile',
    });

    const request = new Request(`http://localhost/api/ai/process?patientId=${patient.id}&limit=5`);
    const response = await GET(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.patientId).toBe(patient.id);
    expect(body.history).toHaveLength(1);
    expect(body.history[0].predictionResult.output).toBe('Integration test treatment plan.');
  });

  it('returns 404 when the patient is missing', async () => {
    const request = new Request('http://localhost/api/ai/process?patientId=non-existent');
    const response = await GET(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatch(/patient not found/i);
  });
});
