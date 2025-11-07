'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ConsultationSession {
  id: string;
  createdAt: string;
  input: string;
  response: string;
  model: string;
  patientId: string;
  cycleId?: string | null;
  clinicalActions?: string[];
  reasoning?: string;
}

interface AIAnalysisResponse {
  response: string;
  clinicalAssessment?: string;
  actionItems?: string[];
  reasoning?: string;
  nextSteps?: string[];
  riskFactors?: string[];
  clinicalActions?: string[];
  timestamp: string;
  model: string;
  patientId?: string;
  cycleId?: string | null;
}

interface PatientSuggestion {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string;
}

const MODEL_NAME = 'llama-3.3-70b-versatile';

export default function Home() {
  const [input, setInput] = useState('');
  const [currentResponse, setCurrentResponse] = useState<AIAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [consultationHistory, setConsultationHistory] = useState<ConsultationSession[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'analysis' | 'history'>('home');
  const [patientInput, setPatientInput] = useState('');
  const [patientId, setPatientId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [patientSuggestions, setPatientSuggestions] = useState<PatientSuggestion[]>([]);
  const [patientLookupLoading, setPatientLookupLoading] = useState(false);
  const [patientLookupError, setPatientLookupError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const suppressLookupRef = useRef(false);
  const lastLookupRef = useRef('');

  const sampleCases = [
    {
      title: 'IVF Consult - Diminished Ovarian Reserve',
      summary: '35 y/o with low AMH and prior failed IUI cycles',
      prompt:
        'Patient: 35-year-old G0P0, AMH 1.2 ng/mL, FSH 8.5 IU/L, AFC 7. Two failed clomiphene + IUI cycles. Regular cycles, BMI 23. Partner sperm parameters normal. Seeking IVF protocol guidance and success outlook.',
    },
    {
      title: 'Male Factor Infertility Workup',
      summary: 'Couple with severe oligospermia planning treatment',
      prompt:
        'Couple attempting conception for 24 months. Male partner semen analysis: volume 1.2 mL, concentration 4 M/mL, motility 22 percent, morphology 1 percent (strict). Female partner 32 y/o with normal ovarian reserve testing. Request evaluation steps, treatment plan, and counseling points.',
    },
    {
      title: 'Recurrent Pregnancy Loss Evaluation',
      summary: '38 y/o with two first-trimester miscarriages',
      prompt:
        'Patient: 38-year-old G3P0, two first-trimester miscarriages after natural conception, one biochemical pregnancy. AMH 2.1 ng/mL, TSH 1.6. No known thrombophilia workup yet. Please outline recommended diagnostic workup, lab panels, and supportive treatment considerations for next conception attempt.',
    },
    {
      title: 'PCOS Ovulation Induction Planning',
      summary: '27 y/o with PCOS preparing for first fertility cycle',
      prompt:
        'Patient: 27-year-old with PCOS (irregular cycles, BMI 31, LH/FSH ratio 2.5), elevated AMH 8.4 ng/mL. No ovulation induction attempted yet. Seeking first-line ovulation induction plan, metabolic optimization recommendations, and monitoring schedule.',
    },
  ];

  const fetchPatientHistory = async (targetPatientId: string) => {
    const trimmedId = targetPatientId.trim();
    if (!trimmedId) {
      setConsultationHistory([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`/api/ai/process?patientId=${encodeURIComponent(trimmedId)}`);
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Unable to load consultation history');
      }

      const payload = await response.json();
      const historyEntries = Array.isArray(payload.history)
        ? (payload.history as Array<Record<string, unknown>>)
        : [];

      const sessions: ConsultationSession[] = historyEntries.map((entry) => {
        const inputData = entry.inputData as Record<string, unknown> | string | undefined;
        const resultData = entry.predictionResult as Record<string, unknown> | string | undefined;
        const responseText =
          typeof resultData === 'string'
            ? resultData
            : (resultData?.output as string | undefined) ?? '';
        const inputText =
          typeof inputData === 'string'
            ? inputData
            : (inputData?.input as string | undefined) ?? '';

        return {
          id: entry.id as string,
          createdAt: entry.createdAt as string,
          input: inputText,
          response: responseText,
          model:
            (typeof resultData === 'object' && resultData && 'model' in resultData
              ? (resultData.model as string | undefined)
              : undefined) ?? (entry.modelVersion as string | undefined) ?? MODEL_NAME,
          patientId: trimmedId,
          cycleId: (entry.cycleId as string | null | undefined) ?? null,
          clinicalActions: extractBulletPoints(responseText, 'ACTION ITEMS'),
          reasoning: extractSection(responseText, 'CLINICAL REASONING'),
        };
      });

      setConsultationHistory(sessions);
    } catch (historyError) {
      console.error('Failed to load consultation history', historyError);
      setHistoryError(historyError instanceof Error ? historyError.message : 'Unknown error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatPatientSummary = (patient: PatientSuggestion) => {
    const fullName = `${patient.firstName} ${patient.lastName}`.trim() || patient.mrn || patient.id;
    const mrnLabel = patient.mrn ? ` • MRN ${patient.mrn}` : '';
    const dobDate = patient.dateOfBirth ? new Date(patient.dateOfBirth) : null;
    const dob = dobDate && !Number.isNaN(dobDate.getTime())
      ? ` • DOB ${dobDate.toLocaleDateString()}`
      : '';
    return `${fullName}${mrnLabel}${dob}`;
  };

  const handlePatientLookup = useCallback(async (query: string) => {
    if (!query) {
      setPatientSuggestions([]);
      setPatientLookupError(null);
      setPatientLookupLoading(false);
      lastLookupRef.current = '';
      return;
    }

    if (query === lastLookupRef.current) {
      return;
    }

    setPatientLookupLoading(true);
    setPatientLookupError(null);
    try {
      const url = `/api/patients?search=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to search patients');
      }

      const payload = await response.json();
      const suggestions = Array.isArray(payload.data)
        ? (payload.data as Array<Record<string, unknown>>).map((entry) => ({
            id: (entry.id as string) ?? '',
            firstName: (entry.firstName as string) ?? '',
            lastName: (entry.lastName as string) ?? '',
            mrn: (entry.mrn as string) ?? '',
            dateOfBirth: (entry.dateOfBirth as string) ?? '',
          }))
        : [];

      setPatientSuggestions(suggestions.filter((suggestion) => suggestion.id));
      lastLookupRef.current = query;
    } catch (lookupError) {
      console.error('Patient lookup failed', lookupError);
      setPatientLookupError(lookupError instanceof Error ? lookupError.message : 'Unknown error');
      setPatientSuggestions([]);
      lastLookupRef.current = '';
    } finally {
      setPatientLookupLoading(false);
    }
  }, []);

  const handlePatientSelection = async (patient: PatientSuggestion) => {
    suppressLookupRef.current = true;
    setPatientInput(formatPatientSummary(patient));
    setPatientId(patient.id);
    setPatientSuggestions([]);
    setPatientLookupLoading(false);
    setPatientLookupError(null);
    lastLookupRef.current = patient.id;
    setFormError(null);
    setHistoryError(null);
    await fetchPatientHistory(patient.id);
  };

  useEffect(() => {
    const trimmed = patientInput.trim();

    if (suppressLookupRef.current) {
      suppressLookupRef.current = false;
      return;
    }

    if (!trimmed) {
      setPatientSuggestions([]);
      setPatientLookupError(null);
      lastLookupRef.current = '';
      return;
    }

    if (trimmed.length < 2) {
      setPatientSuggestions([]);
      lastLookupRef.current = '';
      return;
    }

    const timer = setTimeout(() => {
      void handlePatientLookup(trimmed);
    }, 400);

    return () => clearTimeout(timer);
  }, [handlePatientLookup, patientInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    const trimmedPatientId = (patientId || patientInput).trim();
    const trimmedCycleId = cycleId.trim();

    if (!trimmedInput) {
      return;
    }

    if (!trimmedPatientId) {
      setFormError('Patient ID is required to record consultations.');
      return;
    }

    setFormError(null);
    setLoading(true);

    try {
  const res = await fetch('/api/ai/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmedInput,
          patientId: trimmedPatientId,
          cycleId: trimmedCycleId || undefined,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Unexpected error');
      }

      const data = await res.json();
      const responseText: string = data.response || 'No response received';

      const analysisResponse: AIAnalysisResponse = {
        response: responseText,
        timestamp: data.timestamp,
        model: data.model || MODEL_NAME,
        patientId: data.patientId || trimmedPatientId,
        cycleId: data.cycleId ?? (trimmedCycleId || null),
        clinicalAssessment: extractSection(responseText, 'CLINICAL ASSESSMENT'),
        actionItems: extractBulletPoints(responseText, 'ACTION ITEMS'),
        reasoning: extractSection(responseText, 'CLINICAL REASONING'),
        nextSteps: extractBulletPoints(responseText, 'NEXT STEPS'),
        riskFactors: extractBulletPoints(responseText, 'RISK FACTORS'),
      };

      setCurrentResponse(analysisResponse);
      setHistoryError(null);
      await fetchPatientHistory(trimmedPatientId);
      setCurrentView('analysis');
    } catch (error) {
      console.error('AI request failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse: AIAnalysisResponse = {
        response: errorMessage.startsWith('Failed')
          ? errorMessage
          : `Error: ${errorMessage}. Please retry your request.`,
        timestamp: new Date().toISOString(),
        model: 'error',
        patientId: trimmedPatientId,
        cycleId: trimmedCycleId || null,
      };
      setCurrentResponse(errorResponse);
      setCurrentView('analysis');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions to extract structured information from AI response
  const extractSection = (text: string, sectionTitle: string): string | undefined => {
    const regex = new RegExp(`${sectionTitle}:?\\s*([\\s\\S]*?)(?=\\n\\n|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : undefined;
  };

  const extractBulletPoints = (text: string, sectionTitle: string): string[] | undefined => {
    const section = extractSection(text, sectionTitle);
    if (!section) return undefined;
    
    const bullets = section.split('\n')
      .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      .map(line => line.replace(/^[•\-\d\.]\s*/, '').trim())
      .filter(line => line.length > 0);
    
    return bullets.length > 0 ? bullets : undefined;
  };

  // Format analysis text for better readability
  const formatAnalysisForDisplay = (text: string) => {
    const sections = text.split(/(?=##|\n##)/);
    
    return sections.map((section, index) => {
      const lines = section.trim().split('\n');
      if (lines.length === 0) return null;

      // Check if this is a header line
      const headerMatch = lines[0].match(/^##\s*(.+):/);
      if (headerMatch) {
        const title = headerMatch[1];
        const content = lines.slice(1).join('\n').trim();
        
        // Get appropriate icon for section
        const getIcon = (title: string) => {
          if (title.includes('CLINICAL ASSESSMENT')) return '🩺';
          if (title.includes('CLINICAL REASONING')) return '🧠';
          if (title.includes('ACTION ITEMS')) return '✅';
          if (title.includes('NEXT STEPS')) return '👣';
          if (title.includes('RISK FACTORS')) return '⚠️';
          if (title.includes('SUCCESS PROBABILITY')) return '📊';
          if (title.includes('PATIENT COUNSELING')) return '💬';
          return '📋';
        };

        const getColorClass = (title: string) => {
          if (title.includes('CLINICAL ASSESSMENT')) return 'bg-blue-50 border-blue-200';
          if (title.includes('CLINICAL REASONING')) return 'bg-purple-50 border-purple-200';
          if (title.includes('ACTION ITEMS')) return 'bg-green-50 border-green-200';
          if (title.includes('NEXT STEPS')) return 'bg-cyan-50 border-cyan-200';
          if (title.includes('RISK FACTORS')) return 'bg-yellow-50 border-yellow-200';
          if (title.includes('SUCCESS PROBABILITY')) return 'bg-indigo-50 border-indigo-200';
          if (title.includes('PATIENT COUNSELING')) return 'bg-pink-50 border-pink-200';
          return 'bg-gray-50 border-gray-200';
        };

        return (
          <div key={index} className={`rounded-lg border-2 p-5 mb-4 ${getColorClass(title)}`}>
            <h4 className="text-lg font-bold fertility-text-primary mb-3 flex items-center">
              <span className="text-xl mr-2">{getIcon(title)}</span>
              {title}
            </h4>
            <div className="space-y-3">
              {formatSectionContent(content)}
            </div>
          </div>
        );
      }

      // Handle non-header content
      return (
        <div key={index} className="mb-4">
          {formatSectionContent(section)}
        </div>
      );
    }).filter(Boolean);
  };

  // Format content within sections
  const formatSectionContent = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      
      // Handle bullet points
      if (trimmedLine.match(/^[•\-]\s/)) {
        return (
          <div key={index} className="flex items-start space-x-2 mb-2">
            <span className="fertility-text-primary text-lg mt-0.5">•</span>
            <span className="text-slate-700 leading-relaxed">{trimmedLine.replace(/^[•\-]\s/, '')}</span>
          </div>
        );
      }

      // Handle numbered lists
      if (trimmedLine.match(/^\d+\.\s/)) {
        return (
          <div key={index} className="flex items-start space-x-2 mb-2">
            <span className="fertility-text-primary font-semibold">{trimmedLine.match(/^\d+/)}</span>
            <span className="text-slate-700 leading-relaxed">{trimmedLine.replace(/^\d+\.\s/, '')}</span>
          </div>
        );
      }

      // Handle regular paragraphs - break long ones
      if (trimmedLine.length > 0) {
        return (
          <p key={index} className="text-slate-700 leading-relaxed mb-3 break-words">
            {trimmedLine}
          </p>
        );
      }

      return null;
    }).filter(Boolean);
  };

  const handleSampleSelect = (prompt: string) => {
    setInput(prompt);
    setFormError(null);
    textareaRef.current?.focus();
  };

  const goBack = () => {
    setCurrentView('home');
    setCurrentResponse(null);
    setHistoryError(null);
  };

  const viewHistory = () => {
    const trimmedId = (patientId || patientInput).trim();
    if (!trimmedId) {
      setFormError('Enter a patient ID to view history.');
      return;
    }
    setCurrentView('history');
    setHistoryError(null);
    setPatientSuggestions([]);
    void fetchPatientHistory(trimmedId);
  };

  const loadHistoryItem = (session: ConsultationSession) => {
    setInput(session.input);
    setPatientId(session.patientId);
    setCycleId(session.cycleId ?? '');
    const responseText = session.response;
    const historyResponse: AIAnalysisResponse = {
      response: responseText,
      clinicalActions: session.clinicalActions,
      reasoning: session.reasoning,
      clinicalAssessment: extractSection(responseText, 'CLINICAL ASSESSMENT'),
      actionItems:
        session.clinicalActions ?? extractBulletPoints(responseText, 'ACTION ITEMS'),
      nextSteps: extractBulletPoints(responseText, 'NEXT STEPS'),
      riskFactors: extractBulletPoints(responseText, 'RISK FACTORS'),
      timestamp: session.createdAt,
      model: session.model,
      patientId: session.patientId,
      cycleId: session.cycleId ?? null,
    };
    setCurrentResponse(historyResponse);
    setCurrentView('analysis');
  };

  return (
    <div className="min-h-screen fertility-gradient py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with Navigation */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              {currentView !== 'home' && (
                <button
                  onClick={goBack}
                  className="fertility-button px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all"
                >
                  ← Back to Home
                </button>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={viewHistory}
                className="fertility-button px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all"
              >
                📋 Consultation History ({consultationHistory.length})
              </button>
            </div>
          </div>
          
          <h1 className="text-5xl font-bold fertility-text-primary mb-4 tracking-tight">
            🌸 FertiClaude AI Assistant
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Comprehensive AI-powered clinical decision support for fertility healthcare professionals
          </p>
        </div>

        {/* Main Content Area */}
        {currentView === 'home' && (
          <>
            {/* Consultation Input */}
            <div className="fertility-card p-8 mb-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-lg font-semibold fertility-text-primary mb-2">
                      🧑‍⚕️ Patient ID
                    </label>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col">
                        <input
                          value={patientInput}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPatientInput(value);
                            setPatientId(value.trim());
                            setFormError(null);
                            setPatientLookupError(null);
                            setPatientSuggestions([]);
                          }}
                          className="flex-1 p-3 border-2 border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-300 focus:border-rose-300 bg-white text-slate-700 placeholder-slate-400"
                          placeholder="Search by name, MRN, or paste an ID"
                          autoComplete="off"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        Required to persist AI summaries and retrieve prior consultations.
                        Suggestions update automatically as you type.
                      </p>
                      {patientLookupLoading && (
                        <p className="text-xs text-rose-500">Searching patients…</p>
                      )}
                      {patientLookupError && (
                        <p className="text-sm text-red-600">{patientLookupError}</p>
                      )}
                      {patientSuggestions.length > 0 && (
                        <div className="space-y-2">
                          {patientSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.id}
                              type="button"
                              onClick={() => handlePatientSelection(suggestion)}
                              className="w-full text-left border border-rose-200 rounded-lg px-4 py-3 bg-white hover:border-rose-400 hover:shadow-md transition"
                            >
                              <p className="font-semibold fertility-text-primary">
                                {formatPatientSummary(suggestion)}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">Select to load history</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-lg font-semibold fertility-text-primary mb-2">
                      🔄 Cycle ID (optional)
                    </label>
                    <input
                      value={cycleId}
                      onChange={(e) => setCycleId(e.target.value)}
                      className="w-full p-3 border-2 border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-300 focus:border-rose-300 bg-white text-slate-700 placeholder-slate-400"
                      placeholder="Link to a specific treatment cycle"
                      autoComplete="off"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Associate the analysis with an active IVF cycle when available.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-lg font-semibold fertility-text-primary mb-3">
                    🩺 Clinical Consultation Input
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="w-full p-4 border-2 border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-300 focus:border-rose-300 bg-white text-slate-700 placeholder-slate-400 resize-none"
                    rows={6}
                    placeholder="Enter patient data, clinical question, or scenario&#10;&#10;Example: 35-year-old G0P0, AMH 1.2 ng/mL, FSH 8.5 IU/L, AFC 7. Two failed clomiphene + IUI cycles. Regular cycles, BMI 23. Partner sperm parameters normal. Seeking IVF protocol guidance and success outlook."
                  />
                </div>

                {formError && (
                  <p className="text-sm text-red-600">{formError}</p>
                )}

                {/* Document Upload Section - API Ready Placeholder */}
                <div className="border-2 border-dashed border-rose-200 rounded-xl p-6 bg-rose-50/30">
                  <h3 className="text-lg font-semibold fertility-text-primary mb-4 flex items-center">
                    📎 Supporting Documents (Coming Soon)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="fertility-card p-4 text-center opacity-60">
                      <div className="fertility-bg-accent rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                        <span className="text-xl">🧪</span>
                      </div>
                      <h4 className="font-semibold text-sm fertility-text-primary mb-1">Lab Results</h4>
                      <p className="text-xs text-slate-500">AMH, FSH, LH, E2, TSH</p>
                      <p className="text-xs fertility-text-sage mt-1">API Integration Ready</p>
                    </div>
                    <div className="fertility-card p-4 text-center opacity-60">
                      <div className="fertility-bg-accent rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                        <span className="text-xl">🔍</span>
                      </div>
                      <h4 className="font-semibold text-sm fertility-text-primary mb-1">Ultrasound Images</h4>
                      <p className="text-xs text-slate-500">TVU, HSG, Saline sono</p>
                      <p className="text-xs fertility-text-sage mt-1">DICOM Compatible</p>
                    </div>
                    <div className="fertility-card p-4 text-center opacity-60">
                      <div className="fertility-bg-accent rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                        <span className="text-xl">📄</span>
                      </div>
                      <h4 className="font-semibold text-sm fertility-text-primary mb-1">External Reports</h4>
                      <p className="text-xs text-slate-500">Semen analysis, genetics</p>
                      <p className="text-xs fertility-text-sage mt-1">OCR Processing</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 text-center mt-4">
                    🔗 Upload interface ready for EMR integration • HIPAA compliant storage • Multi-format support
                  </p>
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-full fertility-button py-4 px-6 text-lg font-semibold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing Clinical Analysis...
                    </span>
                  ) : (
                    '🔬 Analyze with AI'
                  )}
                </button>
              </form>
            </div>

            {/* Sample Cases Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold fertility-text-primary">📚 Clinical Scenarios</h2>
                <p className="fertility-text-sage font-medium">Click a scenario to load it into the consultation input</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {sampleCases.map((sample, index) => (
                  <button
                    key={sample.title}
                    type="button"
                    onClick={() => handleSampleSelect(sample.prompt)}
                    className="fertility-card p-6 text-left hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="fertility-bg-accent rounded-full p-2 group-hover:scale-110 transition-transform">
                        <span className="text-lg">
                          {index === 0 ? '🧬' : index === 1 ? '👨‍⚕️' : index === 2 ? '💔' : '⚕️'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold fertility-text-primary mb-2 group-hover:text-rose-600 transition-colors">{sample.title}</h3>
                        <p className="text-slate-600 mb-3 leading-relaxed">{sample.summary}</p>
                        <p className="text-sm fertility-text-sage font-semibold">▶ Load Clinical Scenario</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="fertility-card p-6 text-center">
                <div className="fertility-bg-accent rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🧠</span>
                </div>
                <h3 className="font-bold fertility-text-primary mb-2 text-lg">AI Clinical Analysis</h3>
                <p className="text-slate-600 leading-relaxed">
                  Comprehensive fertility assessment with evidence-based treatment recommendations and clinical reasoning
                </p>
              </div>
              <div className="fertility-card p-6 text-center">
                <div className="fertility-bg-accent rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔬</span>
                </div>
                <h3 className="font-bold fertility-text-primary mb-2 text-lg">Lab Interpretation</h3>
                <p className="text-slate-600 leading-relaxed">
                  Automated interpretation of hormone levels, semen analysis, and fertility biomarkers with clinical context
                </p>
              </div>
              <div className="fertility-card p-6 text-center">
                <div className="fertility-bg-accent rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="font-bold fertility-text-primary mb-2 text-lg">Success Prediction</h3>
                <p className="text-slate-600 leading-relaxed">
                  AI-powered outcome predictions and success probabilities based on patient-specific factors and clinical data
                </p>
              </div>
            </div>
          </>
        )}

            {/* Analysis View */}
        {currentView === 'analysis' && currentResponse && (
          <div className="fertility-card p-8">
            <div className="mb-6 border-b border-rose-200 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold fertility-text-primary mb-2">🔬 Clinical Analysis Results</h2>
                <div className="text-sm text-slate-600 space-y-1">
                  <div>
                    Generated {new Date(currentResponse.timestamp).toLocaleString()} · Model
                    {' '}
                    {currentResponse.model}
                  </div>
                  <div>
                    Patient&nbsp;
                    <span className="font-medium text-slate-700">
                      {currentResponse.patientId ?? (patientInput || '—')}
                    </span>
                    {currentResponse.cycleId && (
                      <>
                        {' '}
                        · Cycle <span className="font-medium text-slate-700">{currentResponse.cycleId}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button className="fertility-button px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all text-sm">
                  💾 Save to EMR
                </button>
                <button className="fertility-button px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all text-sm">
                  📧 Share with Team
                </button>
                <button className="fertility-button px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all text-sm">
                  🖨️ Print Report
                </button>
              </div>
            </div>            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Analysis */}
              <div className="lg:col-span-2 space-y-6">
                <div className="fertility-card p-6">
                  <h3 className="text-xl font-bold fertility-text-primary mb-4 flex items-center">
                    📋 Complete Analysis
                  </h3>
                  <div className="prose prose-slate max-w-none">
                    <div className="formatted-analysis text-slate-700 leading-relaxed">
                      {formatAnalysisForDisplay(currentResponse.response)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Clinical Workflow Sidebar */}
              <div className="space-y-4">
                {/* Encounter Documentation */}
                <div className="fertility-card p-4 bg-blue-50">
                  <h4 className="font-bold text-blue-700 mb-3 flex items-center">
                    📝 Encounter Notes
                  </h4>
                  <textarea
                    placeholder="Add clinical notes, observations, or plan modifications..."
                    className="w-full p-3 border border-blue-200 rounded-lg text-sm resize-none"
                    rows={3}
                  />
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs text-slate-500">Auto-save enabled</span>
                    <button className="text-xs fertility-button px-3 py-1 rounded">
                      Add to Chart
                    </button>
                  </div>
                </div>
                {currentResponse.actionItems && (
                  <div className="fertility-card p-4 bg-rose-50">
                    <h4 className="font-bold fertility-text-primary mb-3 flex items-center">
                      ✅ Action Items
                    </h4>
                    <ul className="space-y-2">
                      {currentResponse.actionItems.map((item, index) => (
                        <li key={index} className="text-sm text-slate-700 flex items-start">
                          <span className="text-rose-500 mr-2">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentResponse.nextSteps && (
                  <div className="fertility-card p-4 bg-green-50">
                    <h4 className="font-bold fertility-text-sage mb-3 flex items-center">
                      👣 Next Steps
                    </h4>
                    <ul className="space-y-2">
                      {currentResponse.nextSteps.map((step, index) => (
                        <li key={index} className="text-sm text-slate-700 flex items-start">
                          <span className="text-green-600 mr-2">→</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentResponse.riskFactors && (
                  <div className="fertility-card p-4 bg-yellow-50">
                    <h4 className="font-bold text-yellow-700 mb-3 flex items-center">
                      ⚠️ Risk Factors
                    </h4>
                    <ul className="space-y-2">
                      {currentResponse.riskFactors.map((risk, index) => (
                        <li key={index} className="text-sm text-slate-700 flex items-start">
                          <span className="text-yellow-600 mr-2">!</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* History View */}
        {currentView === 'history' && (
          <div className="fertility-card p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold fertility-text-primary">📋 Consultation History</h2>
              <span className="text-sm text-slate-500">
                Patient: {patientInput.trim() || patientId.trim() || '—'}
              </span>
            </div>

            {historyError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {historyError}
              </div>
            )}

            {historyLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-lg border border-rose-100 bg-white px-4 py-5"
                  >
                    <div className="mb-2 h-4 w-1/4 rounded bg-rose-100/80" />
                    <div className="mb-1 h-3 w-1/2 rounded bg-rose-100/60" />
                    <div className="h-10 rounded bg-rose-50" />
                  </div>
                ))}
              </div>
            ) : consultationHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-xl font-semibold text-slate-600 mb-2">No Consultations Yet</h3>
                <p className="text-slate-500">Run an AI consultation or adjust the patient ID to see prior history.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {consultationHistory.map((session) => (
                  <div
                    key={session.id}
                    className="fertility-card p-4 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => loadHistoryItem(session)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-slate-500 mb-1">
                          {new Date(session.createdAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-400 mb-2">Model • {session.model}</p>
                        <p className="text-slate-700 line-clamp-2">{session.input}</p>
                        {session.clinicalActions && (
                          <p className="text-xs fertility-text-sage mt-2">
                            {session.clinicalActions.length} action items identified
                          </p>
                        )}
                      </div>
                      <button className="fertility-button px-3 py-1 text-sm rounded-lg ml-4">
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
