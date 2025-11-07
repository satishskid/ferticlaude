import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

type PatientSummary = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSearch = searchParams.get('search') ?? '';
    const search = rawSearch.trim();
    const limitParam = searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
    const take = Number.isNaN(parsedLimit)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(parsedLimit, 1), MAX_LIMIT);

    const filters = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { mrn: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const patients = await prisma.patient.findMany({
      where: filters,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mrn: true,
        dateOfBirth: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take,
    });

    return NextResponse.json({
      data: patients satisfies PatientSummary[],
      count: patients.length,
      hasMore: patients.length === take,
    });
  } catch (error) {
    console.error('Failed to load patients', error);
    return NextResponse.json(
      {
        error: 'Unable to retrieve patients. Please try again later.',
      },
      { status: 500 },
    );
  }
}
