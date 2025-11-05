'use client';

import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/ai/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      const data = await res.json();
      setResponse(data.response || 'No response received');
    } catch (error) {
      setResponse('Error: Unable to process request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            FertiClaude AI Assistant
          </h1>
          <p className="text-xl text-gray-600">
            Advanced AI-powered fertility clinic assistant for healthcare professionals
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Clinical Question or Patient Data:
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Example: 35-year-old patient with AMH 1.2, FSH 8.5, seeking IVF consultation..."
              />
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processing...' : 'Analyze with AI'}
            </button>
          </form>

          {response && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">AI Analysis:</h3>
              <div className="bg-gray-50 p-4 rounded-md">
                <pre className="whitespace-pre-wrap text-gray-700">{response}</pre>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-900 mb-2">Patient Analysis</h3>
            <p className="text-gray-600 text-sm">
              Comprehensive fertility assessment and treatment recommendations
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-900 mb-2">Lab Results</h3>
            <p className="text-gray-600 text-sm">
              Automated interpretation of hormone levels and fertility markers
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-900 mb-2">Success Prediction</h3>
            <p className="text-gray-600 text-sm">
              AI-powered outcome predictions based on patient data
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
