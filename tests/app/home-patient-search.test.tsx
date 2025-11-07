import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll, type MockInstance } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '@/app/page';

const originalFetch = global.fetch;
const fetchMock = vi.fn<typeof fetch>();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Home patient search experience', () => {
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

  it('does not trigger lookups for queries shorter than two characters', async () => {
    render(<Home />);

    const patientInput = screen.getByPlaceholderText('Search by name, MRN, or paste an ID');
    fireEvent.change(patientInput, { target: { value: 'A' } });

    await sleep(450);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and displays patient suggestions after debounce', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'patient-123',
              firstName: 'Ada',
              lastName: 'Lovelace',
              mrn: 'MRN42',
              dateOfBirth: '1990-12-10',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<Home />);

    const patientInput = screen.getByPlaceholderText('Search by name, MRN, or paste an ID');
    fireEvent.change(patientInput, { target: { value: 'Ada' } });

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 2000 });

    const suggestionButton = await screen.findByRole('button', {
      name: /Ada Lovelace/i,
    }, { timeout: 2000 });
    expect(suggestionButton).toBeInTheDocument();
  });

  it('populates the patient input and loads history when a suggestion is selected', async () => {
    fetchMock.mockImplementation((input) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      if (url.includes('/api/patients')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  id: 'patient-99',
                  firstName: 'Grace',
                  lastName: 'Hopper',
                  mrn: 'MRN-7',
                  dateOfBirth: '1906-12-09',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/ai/process')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ history: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<Home />);

    const patientInput = screen.getByPlaceholderText('Search by name, MRN, or paste an ID');
    fireEvent.change(patientInput, { target: { value: 'Grace' } });

    const suggestionButton = await screen.findByRole('button', {
      name: /Grace Hopper/i,
    }, { timeout: 2000 });

    fireEvent.click(suggestionButton);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 2000 });

  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('patientId=patient-99'));
  const selectedValue = (patientInput as HTMLInputElement).value;
  expect(selectedValue).toContain('Grace Hopper');
  expect(selectedValue).toContain('MRN MRN-7');
    expect(screen.queryByText(/Select to load history/i)).not.toBeInTheDocument();
  });

  it('surfaces lookup errors when the patient search fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'Service unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<Home />);

    const patientInput = screen.getByPlaceholderText('Search by name, MRN, or paste an ID');
    fireEvent.change(patientInput, { target: { value: 'Zo' } });

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 2000 });

    const errorMessage = await screen.findByText('Service unavailable', undefined, { timeout: 2000 });
    expect(errorMessage).toBeInTheDocument();
  });
});
