// apps/api/src/services/knowledgeBase.service.ts
//
// WHY THIS FILE EXISTS
// ---------------------
// Retrieval for the narrative/explanatory academy content that doesn't
// belong in a structured DB field - founder bio, program descriptions,
// admission process, branch profiles (see knowledge/*.md). Structured
// facts with exact values (schedules, fees, branch availability) stay
// owned by businessQuery.service.ts against real DB rows - this file is
// deliberately NOT a second source of truth for those, it only carries
// the human-readable explanation around them.
//
// Retrieval here is metadata + keyword matching, not embeddings/vector
// search - at ~10 short documents, a real semantic-search pipeline would
// be new infrastructure (embedding calls, a vector store) disproportionate
// to the actual content volume. If the knowledge base ever grows enough
// to need real semantic search, this is the one place that would change -
// callers just get back relevant doc bodies, however they were found.

import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger';

const log = logger.child({ module: 'knowledge-base' });

const KNOWLEDGE_DIR = path.join(__dirname, '..', '..', 'knowledge');

export interface KnowledgeDoc {
  metadata: Record<string, string>;
  body: string;
  relativePath: string;
}

let cache: KnowledgeDoc[] | null = null;

function parseFrontmatter(raw: string): { metadata: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { metadata: {}, body: raw.trim() };

  const [, frontmatter, body] = match;
  const metadata: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    const kv = line.match(/^([a-zA-Z_]+):\s*"?(.*?)"?\s*$/);
    if (kv) metadata[kv[1]] = kv[2];
  }
  return { metadata, body: body.trim() };
}

function walk(dir: string, docs: KnowledgeDoc[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, docs);
    } else if (entry.name.endsWith('.md')) {
      const raw = fs.readFileSync(full, 'utf8');
      const { metadata, body } = parseFrontmatter(raw);
      docs.push({ metadata, body, relativePath: path.relative(KNOWLEDGE_DIR, full) });
    }
  }
}

function loadAll(): KnowledgeDoc[] {
  if (cache) return cache;
  const docs: KnowledgeDoc[] = [];
  if (fs.existsSync(KNOWLEDGE_DIR)) {
    walk(KNOWLEDGE_DIR, docs);
  } else {
    log.warn('Knowledge directory not found', { KNOWLEDGE_DIR });
  }
  cache = docs.filter((d) => (d.metadata.status ?? 'active') === 'active'); // only ever surface active/current docs (see VERSIONING)
  return cache;
}

const CATEGORY_TRIGGERS: Record<string, string[]> = {
  founder_profile: ['founder', 'head coach', 'sifu', 'who started', 'who runs', 'owner'],
  academy_information: ['about the academy', 'about kombat', 'tell me about', 'what is kombat'],
  programs: ['what martial arts', 'what do you teach', 'disciplines', 'programs'],
  admission: ['admission', 'how do i join', 'enroll', 'sign up', 'process'],
  demo: ['demo', 'trial', 'free class', 'free session'],
  branch_information: ['main branch', 'begur', 'koppa', 'adon', 'hosa road', 'which branch', 'branches'],
};

function scoreDoc(doc: KnowledgeDoc, text: string): number {
  let score = 0;
  const category = doc.metadata.category;
  const triggers = category ? CATEGORY_TRIGGERS[category] ?? [] : [];
  for (const trigger of triggers) {
    if (text.includes(trigger)) score += 2;
  }
  return score;
}

/**
 * Returns the (small number of) documents relevant to this message, or an
 * empty array if nothing clears the relevance bar - callers should NOT
 * inject anything when this returns empty (see "don't overload the
 * context" - a fee question should never pull in the founder bio).
 */
function retrieve(messageText: string, maxDocs = 2): KnowledgeDoc[] {
  const text = messageText.toLowerCase();
  const scored = loadAll()
    .map((doc) => ({ doc, score: scoreDoc(doc, text) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxDocs).map((s) => s.doc);
}

export const knowledgeBaseService = { retrieve, loadAll };
