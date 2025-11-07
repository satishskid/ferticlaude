import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll, type MockInstance } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '@/app/page';

const originalFetch = global.fetch;
const fetchMock = vi.fn<typeof fetch>();
const jsonHeaders = { 'Content-Type': 'application/json' } as const;

const toUrl = (input: Parameters<typeof fetch>[0]) => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

describe('Home consultation workflows', () => {
  let consoleErrorSpy: MockInstance<typeof console.error>;

  beforeAll(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('loads consultation history and allows opening an entry', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          history: [
            {
              id: 'session-1',
              createdAt: '2025-05-01T12:00:00Z',
              predictionType: 'ai_processing_general',
              predictionResult: {
                output: 'Action plan output',
                model: 'llama-3.3-70b-versatile',
              },
              inputData: {
                input: 'Patient baseline details',
              },
              modelVersion: 'llama-3.3-70b-versatile',
              confidenceScore: 0.92,
              cycleId: 'cycle-42',
            },
          ],
        }),
        { status: 200, headers: jsonHeaders },
      ),
    );

    render(<Home />);

    fireEvent.change(
      screen.getByPlaceholderText('Search by name, MRN, or paste an ID'),
      { target: { value: 'p' } },
    );

    fireEvent.click(screen.getByRole('button', { name: /Consultation History/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(toUrl(fetchMock.mock.calls[0][0])).toContain('/api/ai/process?patientId=p');

    const historyEntry = await screen.findByText('Patient baseline details', undefined, { timeout: 2000 });
    expect(historyEntry).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    await waitFor(
      () => expect(screen.getByText(/Clinical Analysis Results/)).toBeInTheDocument(),
      { timeout: 2000 },
    );
    expect(screen.getByText('Action plan output')).toBeInTheDocument();
  });

  it('submits an AI consultation and renders the analysis view', async () => {
    const timestamp = new Date('2025-05-01T12:05:00Z').toISOString();

    fetchMock
      .mockImplementationOnce((input, init) => {
        expect(toUrl(input)).toBe('/api/ai/process');
        expect(init?.method).toBe('POST');
        const body = JSON.parse((init?.body as string | undefined) ?? '{}');
        expect(body).toEqual({
          message: 'Cycle monitoring update',
          patientId: 'p',
          cycleId: 'cycle-42',
        });

        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: 'Analysis summary with recommendations.',
              timestamp,
              model: 'llama-3.3-70b-versatile',
              patientId: 'p',
              cycleId: 'cycle-42',
              predictionId: 'prediction-1',
            }),
            { status: 200, headers: jsonHeaders },
          ),
        );
      })
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ history: [] }),
          { status: 200, headers: jsonHeaders },
        ),
      );

    render(<Home />);

    fireEvent.change(
      screen.getByPlaceholderText('Search by name, MRN, or paste an ID'),
      { target: { value: 'p' } },
    );
    fireEvent.change(
      screen.getByPlaceholderText('Link to a specific treatment cycle'),
      { target: { value: 'cycle-42' } },
    );
    fireEvent.change(
      screen.getByPlaceholderText(/Enter patient data/i),
      { target: { value: 'Cycle monitoring update' } },
    );

    fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 2000 });

    expect(screen.getByText(/Clinical Analysis Results/)).toBeInTheDocument();
    expect(screen.getByText('Analysis summary with recommendations.')).toBeInTheDocument();
    const patientBlock = screen.getByText(/Patient/, { exact: false });
    const normalizedText = patientBlock.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    expect(normalizedText).toContain('Patient p');
    expect(normalizedText).toContain('Cycle cycle-42');
  });

  it('shows the empty history state when no consultations exist', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ history: [] }),
        { status: 200, headers: jsonHeaders },
      ),
    );

    render(<Home />);

    fireEvent.change(
      screen.getByPlaceholderText('Search by name, MRN, or paste an ID'),
      { target: { value: 'patient-empty' } },
    );

    fireEvent.click(screen.getByRole('button', { name: /Consultation History/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 2000 });

    expect(await screen.findByText('No Consultations Yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Run an AI consultation or adjust the patient ID/, { exact: false }),
    ).toBeInTheDocument();
  });

  it('displays an error banner when history retrieval fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'Data service unavailable' }),
        { status: 500, headers: jsonHeaders },
      ),
    );

    render(<Home />);

    fireEvent.change(
      screen.getByPlaceholderText('Search by name, MRN, or paste an ID'),
      { target: { value: 'patient-error' } },
    );

    fireEvent.click(screen.getByRole('button', { name: /Consultation History/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 2000 });

    expect(await screen.findByText('Data service unavailable')).toBeInTheDocument();
  });

  it('prevents AI submission when no patient identifier is provided', async () => {
    render(<Home />);

    fireEvent.change(
      screen.getByPlaceholderText(/Enter patient data/i),
      { target: { value: 'Cycle monitoring update' } },
    );

    fireEvent.click(screen.getByRole('button', { name: /Analyze with AI/ }));

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled(), { timeout: 200 });
    expect(await screen.findByText('Patient ID is required to record consultations.')).toBeInTheDocument();
  });
});
