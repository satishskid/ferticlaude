import { NextRequest, NextResponse } from 'next/server';
import { testDatabaseConnection, prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test basic database connection
    const connectionSuccess = await testDatabaseConnection();
    
    if (!connectionSuccess) {
      return NextResponse.json({
        status: 'error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // Test a simple query to verify schema
    try {
      const clinicsCount = await prisma.clinic.count();
      const patientsCount = await prisma.patient.count();
      const aiInteractionsCount = await prisma.aIPrediction.count();

      return NextResponse.json({
        status: 'success',
        message: 'Database connection and schema validated',
        database: {
          connected: true,
          clinics: clinicsCount,
          patients: patientsCount,
          aiInteractions: aiInteractionsCount,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasDbUrl: !!process.env.DATABASE_URL,
          hasGroqKey: !!process.env.GROQ_API_KEY,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (schemaError) {
      return NextResponse.json({
        status: 'warning',
        message: 'Database connected but schema may need migration',
        error: schemaError instanceof Error ? schemaError.message : 'Unknown schema error',
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
