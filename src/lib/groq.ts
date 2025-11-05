import Groq from 'groq-sdk';

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY environment variable is required');
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface FertilityAnalysisInput {
  patientAge?: number;
  medicalHistory?: string;
  labResults?: string;
  question?: string;
  symptoms?: string;
  treatmentHistory?: string;
}

export interface FertilityAnalysisResult {
  clinicalAssessment: string;
  recommendations: string[];
  riskFactors: string[];
  nextSteps: string[];
  successProbability?: string;
  additionalTests?: string[];
}

class FertilityAI {
  private readonly systemPrompt = `You are an expert fertility specialist AI assistant with deep knowledge of reproductive endocrinology, assisted reproductive technology (ART), and fertility treatments. 

Your role is to provide clinical decision support for healthcare professionals working in fertility clinics. You should:

1. CLINICAL ASSESSMENT: Analyze patient data including age, hormone levels (AMH, FSH, LH, E2, etc.), medical history, and symptoms
2. EVIDENCE-BASED RECOMMENDATIONS: Provide treatment recommendations based on current fertility medicine guidelines
3. RISK STRATIFICATION: Identify risk factors that may impact fertility outcomes
4. PROTOCOL GUIDANCE: Suggest appropriate stimulation protocols, monitoring schedules, and intervention timing
5. SUCCESS PREDICTION: Estimate treatment success probabilities when sufficient data is available
6. PATIENT COUNSELING POINTS: Highlight key information for patient discussions

IMPORTANT GUIDELINES:
- Always emphasize that this is clinical decision support, not a replacement for physician judgment
- Recommend additional testing when data is insufficient for proper assessment
- Consider patient-specific factors like age, ovarian reserve, male factor issues
- Stay current with ART success rates and evidence-based protocols
- Flag urgent concerns that require immediate medical attention
- Provide compassionate, clear communication suitable for patient counseling

Format your response with clear sections for assessment, recommendations, and next steps.`;

  async processPatientInput(input: string): Promise<string> {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: `Please analyze this fertility case and provide clinical guidance:\n\n${input}`,
          },
        ],
        model: 'llama-3.2-90b-vision-preview',
        temperature: 0.3,
        max_tokens: 2000,
        top_p: 0.9,
      });

      return completion.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      console.error('Groq API error:', error);
      throw new Error('Failed to process fertility consultation');
    }
  }

  async predictOutcome(
    patientData: FertilityAnalysisInput
  ): Promise<FertilityAnalysisResult> {
    const prompt = `Analyze this fertility patient profile and provide a structured assessment:

Patient Age: ${patientData.patientAge || 'Not specified'}
Medical History: ${patientData.medicalHistory || 'Not provided'}
Lab Results: ${patientData.labResults || 'Not provided'}
Current Question: ${patientData.question || 'General consultation'}
Symptoms: ${patientData.symptoms || 'None reported'}
Treatment History: ${patientData.treatmentHistory || 'None'}

Please provide a comprehensive fertility assessment with:
1. Clinical assessment summary
2. Specific recommendations for treatment
3. Risk factors to consider
4. Next steps in care
5. Success probability estimate (if sufficient data)
6. Additional tests needed`;

    try {
      const response = await this.processPatientInput(prompt);
      
      // Parse the structured response (this is a simplified parser)
      // In a real implementation, you might want to use a more sophisticated parsing method
      return {
        clinicalAssessment: response,
        recommendations: ['Detailed analysis provided above'],
        riskFactors: ['See assessment for risk factors'],
        nextSteps: ['Follow recommendations in assessment'],
        successProbability: 'See detailed analysis',
        additionalTests: ['See assessment for test recommendations'],
      };
    } catch (error) {
      throw new Error(`Fertility outcome prediction failed: ${error}`);
    }
  }

  async interpretLabResults(labData: string): Promise<string> {
    const prompt = `As a fertility specialist, please interpret these lab results and provide clinical guidance:

${labData}

Please provide:
1. Interpretation of each relevant hormone/test value
2. Overall ovarian reserve assessment (if applicable)
3. Recommendations for treatment protocols
4. Any concerning values that need attention
5. Suggested timeline for treatment initiation`;

    return this.processPatientInput(prompt);
  }

  async recommendTreatment(
    age: number,
    diagnosis: string,
    priorTreatments?: string
  ): Promise<string> {
    const prompt = `Treatment recommendation request:
- Patient Age: ${age}
- Primary Diagnosis: ${diagnosis}
- Prior Treatments: ${priorTreatments || 'None'}

Please recommend:
1. Most appropriate treatment protocol
2. Expected timeline and monitoring schedule
3. Success rates for this patient profile
4. Alternative options to consider
5. Patient counseling points`;

    return this.processPatientInput(prompt);
  }
}

export const fertilityAI = new FertilityAI();
export default fertilityAI;
