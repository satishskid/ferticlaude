import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Utility function to test database connection
export async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✓ Database connection successful');
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  }
}

// Utility functions for fertility clinic operations
export const fertilityDB = {
  // Patient operations
  async createPatient(data: {
    firstName: string;
    lastName: string;
    mrn: string;
    dateOfBirth: Date;
    phone?: string;
    email?: string;
    clinicId: string;
  }) {
    return await prisma.patient.create({
      data,
    });
  },

  async getPatient(id: string) {
    return await prisma.patient.findUnique({
      where: { id },
      include: {
        profile: true,
        cycles: {
          include: {
            labResults: true,
            aiPredictions: true,
          },
        },
      },
    });
  },

  // AI Interaction tracking
  async logAIInteraction(data: {
    input: string;
    output: string;
    model: string;
    confidence?: number;
    patientId: string;
    cycleId?: string;
    context?: Record<string, unknown>;
  }) {
    const inputPayload: Prisma.JsonObject = {
      input: data.input,
    };

    if (data.context) {
      inputPayload.context = data.context as Prisma.JsonObject;
    }

    return await prisma.aIPrediction.create({
      data: {
        predictionType: 'CONSULTATION',
        inputData: inputPayload,
        predictionResult: { output: data.output, model: data.model },
        confidenceScore: data.confidence || 0.85,
        modelVersion: data.model,
        patient: { connect: { id: data.patientId } },
        cycle: data.cycleId ? { connect: { id: data.cycleId } } : undefined,
      },
    });
  },

  // Lab results operations  
  async createLabResult(data: {
    patientId: string;
    cycleId?: string;
    testType: string;
    values: Prisma.JsonValue;
    testDate: Date;
    referenceRange?: Prisma.JsonValue;
  }) {
    return await prisma.labResult.create({
      data: {
        testType: data.testType,
  values: data.values as Prisma.InputJsonValue,
        testDate: data.testDate,
  referenceRange: data.referenceRange as Prisma.InputJsonValue | undefined,
        patient: { connect: { id: data.patientId } },
        cycle: data.cycleId ? { connect: { id: data.cycleId } } : undefined,
      },
    });
  },

  // Treatment cycle operations
  async createTreatmentCycle(data: {
    patientId: string;
    cycleNumber: number;
    protocolType?: string;
    startDate?: Date;
    status?: 'PLANNING' | 'STIMULATION' | 'MONITORING' | 'TRIGGER' | 'RETRIEVAL' | 'FERTILIZATION' | 'TRANSFER' | 'TWW' | 'POSITIVE' | 'NEGATIVE' | 'CANCELLED' | 'COMPLETED';
  }) {
    return await prisma.treatmentCycle.create({
      data: {
        cycleNumber: data.cycleNumber,
        protocolType: data.protocolType,
        startDate: data.startDate,
        status: data.status || 'PLANNING',
        patient: { connect: { id: data.patientId } },
      },
    });
  },

  // Analytics and reporting
  async getClinicStats(clinicId: string) {
    const [patientsCount, cyclesCount, aiInteractionsCount] = await Promise.all([
      prisma.patient.count({ where: { clinicId } }),
      prisma.treatmentCycle.count({ 
        where: { patient: { clinicId } } 
      }),
      prisma.aIPrediction.count({ 
        where: { patient: { clinicId } }
      }),
    ]);

    return {
      patientsCount,
      cyclesCount,
      aiInteractionsCount,
    };
  },

  // Search and filtering
  async searchPatients(query: string, clinicId?: string) {
    return await prisma.patient.findMany({
      where: {
        AND: [
          clinicId ? { clinicId } : {},
          {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { mrn: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      include: {
        cycles: {
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};

export default prisma;
