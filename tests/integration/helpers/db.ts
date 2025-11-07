import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';

export async function createTestClinic(overrides: { name?: string } = {}) {
  return prisma.clinic.create({
    data: {
      name: overrides.name ?? 'Integration Test Fertility Center',
      email: 'integration-clinic@example.com',
      phone: '+1-555-0100',
    },
  });
}

export async function createTestPatient(
  clinicId: string,
  overrides: {
    firstName?: string;
    lastName?: string;
    mrn?: string;
    dateOfBirth?: Date;
  } = {},
) {
  return prisma.patient.create({
    data: {
      clinicId,
      firstName: overrides.firstName ?? 'Ada',
      lastName: overrides.lastName ?? 'Lovelace',
      mrn: overrides.mrn ?? `MRN-${randomUUID()}`,
      dateOfBirth: overrides.dateOfBirth ?? new Date('1990-12-10T00:00:00.000Z'),
      email: 'ada.lovelace@example.com',
    },
  });
}

export async function createPredictionForPatient(
  patientId: string,
  data: {
    cycleId?: string | null;
    output?: string;
    modelVersion?: string;
  } = {},
) {
  return prisma.aIPrediction.create({
    data: {
      patientId,
      predictionType: 'ai_processing_general',
      inputData: {
        input: 'Cycle monitoring update',
      },
      predictionResult: {
        output: data.output ?? 'Guidance from integration test AI',
      },
      confidenceScore: 0.85,
      modelVersion: data.modelVersion ?? 'llama-3.3-70b-versatile',
      cycleId: data.cycleId ?? null,
    },
  });
}
