'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setMessage('Invalid unsubscribe link.');
      return;
    }
    fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'You have been successfully unsubscribed.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Unable to process your request.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('An error occurred. Please try again later.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="bg-navy-800 rounded-2xl border border-navy-700 shadow-2xl p-10 w-full max-w-md text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gold-500 tracking-widest">RLM&CO</h1>
        </div>
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 text-navy-300">
            <Loader2 className="w-10 h-10 animate-spin text-gold-500" />
            <p>Processing your request...</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <h2 className="text-xl font-semibold text-white">Unsubscribed</h2>
            <p className="text-navy-300">{message}</p>
            <p className="text-navy-400 text-sm mt-2">You will no longer receive emails from this list.</p>
          </div>
        )}
        {(status === 'error' || status === 'invalid') && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12 text-red-400" />
            <h2 className="text-xl font-semibold text-white">Error</h2>
            <p className="text-navy-300">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
