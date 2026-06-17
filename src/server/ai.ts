/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Assistant d'ecriture IA (Anthropic Claude). Optionnel : activé uniquement si
 * ANTHROPIC_API_KEY est défini dans l'environnement (Render). Sinon, l'API
 * renvoie « ai_unavailable » et le client retombe sur son moteur LOCAL.
 *
 * La clé n'est JAMAIS dans le code : elle vient des variables d'environnement.
 */

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-4-8';

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export type AiTask = 'titles' | 'rephrase' | 'summary';

function jsonOf(resp: any): any {
  const block = (resp?.content || []).find((b: any) => b?.type === 'text');
  try { return JSON.parse(block?.text || '{}'); } catch { return {}; }
}

// Schéma de sortie structurée (JSON propre, sans préambule).
const titlesFormat = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: { titles: { type: 'array', items: { type: 'string' } } },
    required: ['titles'],
  },
};
const resultFormat = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: { result: { type: 'string' } },
    required: ['result'],
  },
};

export async function runWritingAssistant(
  task: AiTask,
  text: string,
): Promise<{ titles?: string[]; result?: string }> {
  const c = getClient();
  if (!c) throw new Error('ai_unavailable');
  const excerpt = text.slice(0, 14000);

  if (task === 'titles') {
    const resp = await (c.messages.create as any)({
      model: MODEL,
      max_tokens: 1024,
      system:
        "Tu es un editeur litteraire francophone. Tu proposes des titres de chapitre COURTS (2 a 6 mots), evocateurs et fideles au contenu, qui donnent envie de lire sans spoiler. Tu varies les styles (un mot fort, un groupe nominal, une formule). Pas de guillemets, pas de numerotation, pas de point final.",
      messages: [
        { role: 'user', content: `Analyse ce passage et propose exactement 5 titres de chapitre en francais.\n\nTEXTE :\n${excerpt}` },
      ],
      output_config: { format: titlesFormat },
    });
    const arr = jsonOf(resp).titles;
    const titles = Array.isArray(arr)
      ? arr.map((s: any) => String(s).trim().replace(/^["«»]+|["«»]+$/g, '').trim()).filter(Boolean)
      : [];
    return { titles: titles.slice(0, 6) };
  }

  if (task === 'rephrase') {
    const resp = await (c.messages.create as any)({
      model: MODEL,
      max_tokens: 4000,
      system:
        "Tu es un editeur litteraire francophone. Tu ameliores un passage (fluidite, style, rythme, grammaire, ponctuation) SANS en changer le sens, l'intrigue, les personnages ni le point de vue. Tu conserves la langue francaise, le registre de l'auteur et une longueur similaire. Tu ne rajoutes pas d'evenements.",
      messages: [
        { role: 'user', content: `Reecris ce passage pour l'ameliorer, en respectant scrupuleusement le sens d'origine.\n\nTEXTE :\n${excerpt}` },
      ],
      output_config: { format: resultFormat },
    });
    return { result: String(jsonOf(resp).result || '').trim() };
  }

  // summary / accroche
  const resp = await (c.messages.create as any)({
    model: MODEL,
    max_tokens: 600,
    system:
      "Tu es un editeur. Tu rediges une accroche (resume incitatif) de 1 a 2 phrases, en francais, SANS spoiler, qui donne envie de lire le chapitre.",
    messages: [
      { role: 'user', content: `Redige l'accroche de ce chapitre.\n\nTEXTE :\n${excerpt}` },
    ],
    output_config: { format: resultFormat },
  });
  return { result: String(jsonOf(resp).result || '').trim() };
}
