/**
 * AiPanel.tsx — Gemini AI market analyst chat panel.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, AlertCircle } from 'lucide-react';
import { streamMarketAnalysis, MarketSnapshot } from '../utils/geminiClient';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
}

interface AiPanelProps {
  apiKey: string;
  snap: MarketSnapshot;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  '¿Qué me dice el precio actual?',
  '¿Debería abrir un long aquí?',
  'Analiza las últimas velas',
  '¿Cuál es el soporte más cercano?',
];

export default function AiPanel({ apiKey, snap, onClose }: AiPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: `Hola. Soy tu analista de XAU/USD. El precio actual es **$${snap.currentPrice.toFixed(2)}**. ¿Qué quieres analizar?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setError(null);
    const userMsg: Message = { role: 'user', text };
    const assistantMsg: Message = { role: 'assistant', text: '', streaming: true };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      const gen = streamMarketAnalysis(apiKey, text, snap);
      for await (const chunk of gen) {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, text: last.text + chunk };
          return copy;
        });
      }
    } catch (err) {
      setError('Error al conectar con Gemini. Verifica la API key en Settings.');
      setMessages(prev => prev.slice(0, -1)); // Remove empty assistant msg
    } finally {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], streaming: false };
        return copy;
      });
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  };

  const formatText = (text: string) => {
    // Minimal markdown: **bold** and newlines
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="flex flex-col h-full bg-surface-container border border-outline-variant/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30 bg-surface-container-high flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-display font-semibold text-xs text-primary uppercase tracking-wider">
            Gemini Market Analyst
          </span>
          <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono uppercase font-bold">
            XAU/USD
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface cursor-pointer outline-none"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] text-xs leading-relaxed px-3 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-primary/15 text-on-surface border border-primary/20'
                  : 'bg-surface-container-low text-on-surface/90 border border-outline-variant/20'
              }`}
            >
              {msg.role === 'assistant' ? (
                <span dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
              ) : (
                msg.text
              )}
              {msg.streaming && (
                <span className="inline-block w-1.5 h-3.5 bg-primary/70 ml-0.5 animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/5 border border-red-400/20 rounded px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-4 pb-2 flex gap-2 flex-wrap flex-shrink-0 border-t border-outline-variant/15 pt-2">
        {QUICK_PROMPTS.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={isStreaming}
            className="text-[10px] font-mono text-on-surface-variant bg-surface-container border border-outline-variant/30 hover:border-primary/40 hover:text-primary px-2.5 py-1 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors outline-none"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex gap-2 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="Pregunta al analista…"
          disabled={isStreaming}
          className="flex-1 bg-surface-container border border-outline-variant/30 rounded px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary/50 disabled:opacity-50 font-mono"
        />
        <button
          onClick={() => send(input)}
          disabled={isStreaming || !input.trim()}
          className="bg-primary/15 border border-primary/30 hover:bg-primary/25 text-primary rounded px-3 py-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors outline-none flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
