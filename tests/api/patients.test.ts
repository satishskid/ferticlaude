import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, type MockInstance } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/patients/route';

const { mockPatientFindMany } = vi.hoisted(() => ({
  mockPatientFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    patient: {
      findMany: mockPatientFindMany,
    },
  },
}));

const toNextRequest = (request: Request): NextRequest => request as unknown as NextRequest;

const samplePatient = {
  id: 'patient-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  mrn: 'MRN-01',
  dateOfBirth: new Date('1990-12-10T00:00:00.000Z'),
};

describe('/api/patients route', () => {
  let consoleErrorSpy: MockInstance<typeof console.error>;

  beforeAll(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    mockPatientFindMany.mockReset();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns patient summaries using the default limit', async () => {
    mockPatientFindMany.mockResolvedValueOnce([samplePatient]);

    const request = new Request('http://localhost/api/patients?search=Ada');
    const response = await GET(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.count).toBe(1);
    expect(body.hasMore).toBe(false);
    expect(mockPatientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
        take: 20,
      }),
    );
  });

  it('caps the limit to the maximum allowed', async () => {
    mockPatientFindMany.mockResolvedValueOnce(Array.from({ length: 50 }, (_, index) => ({
      ...samplePatient,
      id: `patient-${index}`,
      mrn: `MRN-${index}`,
    })));

    const request = new Request('http://localhost/api/patients?search=x&limit=999');
    await GET(toNextRequest(request));

    expect(mockPatientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('handles empty searches without filters', async () => {
    mockPatientFindMany.mockResolvedValueOnce([]);

    const request = new Request('http://localhost/api/patients');
    const response = await GET(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(mockPatientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
        take: 20,
      }),
    );
  });

  it('responds with a 500 when Prisma throws', async () => {
    mockPatientFindMany.mockRejectedValueOnce(new Error('Database unavailable'));

    const request = new Request('http://localhost/api/patients?search=error');
    const response = await GET(toNextRequest(request));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/unable to retrieve patients/i);
  });
});
