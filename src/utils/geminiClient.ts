/**
 * geminiClient.ts — Wrapper around @google/genai for market analysis chat.
 * Uses the Gemini API already declared in metadata.json.
 */
import { GoogleGenAI } from '@google/genai';
import { Candle, Position } from '../types';

let _client: GoogleGenAI | null = null;

function getClient(apiKey: string): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey });
  return _client;
}

export interface MarketSnapshot {
  currentPrice: number;
  changePercent: number;
  recentCandles: Candle[];
  positions: Position[];
  vaultBalance: number;
  high24h: number;
  low24h: number;
}

function buildSystemPrompt(snap: MarketSnapshot): string {
  const lastCandles = snap.recentCandles.slice(-20);
  const candleSummary = lastCandles
    .map(c => `${c.time}: O=${c.open} H=${c.high} L=${c.low} C=${c.close} V=${c.volume}`)
    .join('\n');

  const positionSummary = snap.positions.length
    ? snap.positions
        .map(p => `  ${p.side} ${p.quantity}oz @ ${p.entryPrice} x${p.leverage} | PnL: $${p.pnl.toFixed(2)}`)
        .join('\n')
    : '  (ninguna posición abierta)';

  return `Eres un analista cuantitativo de materias primas especializado en XAU/USD (oro spot). 
Tu estilo es preciso, directo y sin jerga innecesaria. Das respuestas breves a menos que te pidan un análisis extenso.

ESTADO ACTUAL DEL MERCADO:
- Precio spot: $${snap.currentPrice.toFixed(2)}
- Variación: ${snap.changePercent >= 0 ? '+' : ''}${snap.changePercent.toFixed(2)}%
- Máximo 24h: $${snap.high24h.toFixed(2)}
- Mínimo 24h: $${snap.low24h.toFixed(2)}
- Capital disponible: $${snap.vaultBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}

POSICIONES ABIERTAS:
${positionSummary}

ÚLTIMAS 20 VELAS (5M OHLCV):
${candleSummary}

Responde siempre en español. Si el usuario pregunta sobre niveles de entrada, menciona gestión del riesgo.`;
}

export async function* streamMarketAnalysis(
  apiKey: string,
  userMessage: string,
  snap: MarketSnapshot
): AsyncGenerator<string> {
  const client = getClient(apiKey);
  const systemInstruction = buildSystemPrompt(snap);

  const stream = await client.models.generateContentStream({
    model: 'gemini-2.0-flash',
    config: { systemInstruction },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
  });

  for await (const chunk of stream) {
    const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) yield text;
  }
}
