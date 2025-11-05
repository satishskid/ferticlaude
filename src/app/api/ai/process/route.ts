import { NextRequest, NextResponse } from 'next/server';
import { fertilityAI } from '@/lib/groq';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Process the fertility consultation using Groq AI
    const aiResponse = await fertilityAI.processPatientInput(message);

    return NextResponse.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
      model: 'llama-3.2-90b-vision-preview',
      processingTime: 'Real-time AI analysis',
    });
  } catch (error) {
    console.error('AI processing error:', error);
    
    // Provide fallback response for errors
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

    return NextResponse.json({
      response: fallbackResponse,
      timestamp: new Date().toISOString(),
      error: 'AI service temporarily unavailable',
      fallback: true,
    }, { status: 200 }); // Return 200 with fallback content instead of error
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'FertiClaude AI Process API is running',
    version: '2.0.0',
    features: [
      'Groq AI Integration (Llama 3.2 90B Vision)',
      'Fertility Specialist System Prompts',
      'Real-time Clinical Decision Support',
      'Lab Results Interpretation',
      'Treatment Recommendations',
      'Success Probability Estimation'
    ],
    model: 'llama-3.2-90b-vision-preview',
    status: 'operational',
  });
}
