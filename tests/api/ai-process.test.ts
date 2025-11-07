import { describe, expect, it, vi, beforeEach, afterEach, beforeAll, afterAll, type MockInstance } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/ai/process/route';

const {
  mockProcessPatientInput,
  mockPatientFindUnique,
  mockLogAIInteraction,
  mockPredictionFindMany,
} = vi.hoisted(() => ({
  mockProcessPatientInput: vi.fn(),
  mockPatientFindUnique: vi.fn(),
  mockLogAIInteraction: vi.fn(),
  mockPredictionFindMany: vi.fn(),
}));

vi.mock('@/lib/groq', () => ({
  fertilityAI: {
    processPatientInput: mockProcessPatientInput,
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    patient: {
      findUnique: mockPatientFindUnique,
    },
    aIPrediction: {
      findMany: mockPredictionFindMany,
    },
  },
  fertilityDB: {
    logAIInteraction: mockLogAIInteraction,
  },
}));

const toNextRequest = (request: Request): NextRequest => request as unknown as NextRequest;

describe('/api/ai/process route', () => {
  let consoleErrorSpy: MockInstance<typeof console.error>;

  beforeAll(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('rejects requests missing a message payload', async () => {
    const request = new Request('http://localhost/api/ai/process', {
      method: 'POST',
      body: JSON.stringify({ patientId: 'patient_123' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/message is required/i);
    expect(mockProcessPatientInput).not.toHaveBeenCalled();
  });

  it('rejects requests without a patientId', async () => {
    const request = new Request('http://localhost/api/ai/process', {
      method: 'POST',
      body: JSON.stringify({ message: 'Case details' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/patientid is required/i);
    expect(mockProcessPatientInput).not.toHaveBeenCalled();
  });

  it('returns a 404 when the patient does not exist', async () => {
    mockPatientFindUnique.mockResolvedValueOnce(null);

    const request = new Request('http://localhost/api/ai/process', {
      method: 'POST',
      body: JSON.stringify({ message: 'Case details', patientId: 'missing_patient' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatch(/patient not found/i);
  });

  it('returns AI guidance and records the interaction', async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: 'patient_123' });
    mockProcessPatientInput.mockResolvedValueOnce('Structured clinical guidance');
    mockLogAIInteraction.mockResolvedValueOnce({ id: 'prediction_456' });

    const request = new Request('http://localhost/api/ai/process', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Clinical question',
        patientId: 'patient_123',
        context: { vital: 'data' },
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.response).toBe('Structured clinical guidance');
    expect(body.predictionId).toBe('prediction_456');
    expect(mockProcessPatientInput).toHaveBeenCalledWith('Clinical question');
    expect(mockLogAIInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'Clinical question',
        patientId: 'patient_123',
        context: { vital: 'data' },
      }),
    );
  });

  it('continues when audit persistence fails', async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: 'patient_123' });
    mockProcessPatientInput.mockResolvedValueOnce('Answer');
    mockLogAIInteraction.mockRejectedValueOnce(new Error('Database offline'));

    const request = new Request('http://localhost/api/ai/process', {
      method: 'POST',
      body: JSON.stringify({ message: 'Clinical question', patientId: 'patient_123' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.response).toBe('Answer');
    expect(body.predictionId).toBeNull();
    expect(mockLogAIInteraction).toHaveBeenCalled();
  });

  it('provides patient history for GET requests', async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: 'patient_123' });
    mockPredictionFindMany.mockResolvedValueOnce([
      {
        id: 'prediction_1',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        predictionType: 'ai_processing_general',
        predictionResult: { output: 'Report' },
        inputData: { input: 'Input data' },
        modelVersion: 'llama',
        confidenceScore: 0.8,
        cycleId: 'cycle_1',
      },
    ]);

  const request = new Request('http://localhost/api/ai/process?patientId=patient_123&limit=5');
  const response = await GET(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.patientId).toBe('patient_123');
    expect(body.history).toHaveLength(1);
    expect(body.limit).toBe(5);
    expect(mockPredictionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });

  it('returns service metadata when no patientId is provided', async () => {
    const request = new Request('http://localhost/api/ai/process');
    const response = await GET(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('operational');
    expect(Array.isArray(body.features)).toBe(true);
    expect(body.model).toBeDefined();
  });

  it('returns a fallback response when the AI call fails', async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: 'patient_123' });
    mockProcessPatientInput.mockRejectedValueOnce(new Error('Groq outage'));

    const request = new Request('http://localhost/api/ai/process', {
      method: 'POST',
      body: JSON.stringify({ message: 'Any question', patientId: 'patient_123' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fallback).toBe(true);
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(body.response).toMatch(/technical difficulties/i);
    expect(mockLogAIInteraction).not.toHaveBeenCalled();
  });
});
