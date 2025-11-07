import { beforeAll, beforeEach, afterAll } from 'vitest';
import prisma from '@/lib/prisma';

export async function clearDatabase() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.document.deleteMany(),
    prisma.labResult.deleteMany(),
    prisma.aIPrediction.deleteMany(),
    prisma.treatmentCycle.deleteMany(),
    prisma.patientProfile.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.user.deleteMany(),
    prisma.clinic.deleteMany(),
  ]);
}

beforeAll(async () => {
  await clearDatabase();
});

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await clearDatabase();
  await prisma.$disconnect();
});
