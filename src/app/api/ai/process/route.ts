import { NextRequest, NextResponse } from 'next/server';
import { fertilityAI } from '@/lib/groq';
import { fertilityDB, prisma } from '@/lib/prisma';

const MODEL_NAME = 'llama-3.3-70b-versatile';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const patientId = typeof body.patientId === 'string' ? body.patientId.trim() : '';
    const cycleId = typeof body.cycleId === 'string' ? body.cycleId.trim() : undefined;
    const context = body.context && typeof body.context === 'object' ? body.context : undefined;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 },
      );
    }

    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 },
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 },
      );
    }

    const aiResponse = await fertilityAI.processPatientInput(message);

    let predictionId: string | null = null;
    try {
      const record = await fertilityDB.logAIInteraction({
        input: message,
        output: aiResponse,
        model: MODEL_NAME,
        patientId,
        cycleId,
        context,
      });
      predictionId = record.id;
    } catch (logError) {
      console.error('Failed to persist AI interaction:', logError);
    }

    return NextResponse.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
      model: MODEL_NAME,
      patientId,
      cycleId: cycleId ?? null,
      predictionId,
    });
  } catch (error) {
    console.error('AI processing error:', error);

    const fallbackResponse = `I apologize, but I'm currently experiencing technical difficulties processing your fertility consultation.

Please try again in a moment, or consider the following general guidance:

**For fertility consultations, please ensure you include:**
- Patient age
- Relevant hormone levels (AMH, FSH, LH, E2 if available)
- Medical history relevant to fertility
- Current symptoms or concerns
- Any prior fertility treatments

**For immediate clinical concerns:**
- Contact your healthcare provider directly
- This AI assistant provides decision support only
- Always consult with qualified medical professionals

The system should be back online shortly. Thank you for your patience.`;

    return NextResponse.json(
      {
        response: fallbackResponse,
        timestamp: new Date().toISOString(),
        error: 'AI service temporarily unavailable',
        fallback: true,
      },
      { status: 200 },
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const takeParam = searchParams.get('limit');
  const limit = takeParam ? Math.min(parseInt(takeParam, 10) || 10, 50) : 10;

  if (!patientId) {
    return NextResponse.json({
      message: 'FertiClaude AI Process API is running',
      version: '2.0.0',
      features: [
        'Groq AI Integration (Llama 3.3 70B Versatile)',
        'Fertility Specialist System Prompts',
        'Real-time Clinical Decision Support',
        'Lab Results Interpretation',
        'Treatment Recommendations',
        'Success Probability Estimation',
      ],
      model: MODEL_NAME,
      status: 'operational',
    });
  }

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 },
      );
    }

    const history = await prisma.aIPrediction.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        predictionType: true,
        predictionResult: true,
        inputData: true,
        modelVersion: true,
        confidenceScore: true,
        cycleId: true,
      },
    });

    return NextResponse.json({
      patientId,
      limit,
      history,
    });
  } catch (error) {
    console.error('Failed to retrieve AI history:', error);
    return NextResponse.json(
      { error: 'Failed to load AI history' },
      { status: 500 },
    );
  }
}
