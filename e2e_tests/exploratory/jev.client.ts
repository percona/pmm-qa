import { choice, noul, TypeSafeClient } from '@typesafe-ai/sdk';

export type CandidateRole = 'button' | 'link' | 'tab' | 'menuitem' | 'checkbox' | 'combobox';

export interface Candidate {
  index: number;
  role: CandidateRole;
  name: string;
  frame: number;
}

export interface Snapshot {
  url: string;
  title: string;
  visibleText: string;
  consoleErrors: string[];
  failedRequests: string[];
  candidates: Candidate[];
  visited: string[];
}

export interface Verdict {
  broken: number;
  deadEnd: number;
  next: number | undefined;
  nextConfidence: number;
  latencyMs: number;
}

const BROKEN_CRITERIA = {
  false:
    'A normal PMM screen, including empty states that explain themselves and legitimate confirmation dialogs',
  true: 'A stack trace, a raw error object or JSON dumped to the user, an untranslated i18n key, a permanently empty required widget, an infinite spinner, or a control that visibly did nothing',
};

export class JevExplorer {
  private client = new TypeSafeClient();
  latencies: number[] = [];

  decide = async (s: Snapshot): Promise<Verdict> => {
    const criteria = Object.fromEntries(s.candidates.map((c) => [String(c.index), `${c.role}: ${c.name}`]));
    const started = Date.now();
    const { answers } = await this.client.systemOne({
      questions: {
        broken: noul('This PMM screen is in a broken state', BROKEN_CRITERIA),
        dead_end: noul('This screen leads nowhere new — it repeats what has already been visited'),
        next: choice('Which control leads to PMM functionality not yet explored', criteria),
      },
      state: {
        already_visited: s.visited,
        console_errors: s.consoleErrors,
        failed_requests: s.failedRequests,
        screen: s.visibleText,
        title: s.title,
        url: s.url,
      },
    });
    const latencyMs = Date.now() - started;

    this.latencies.push(latencyMs);

    const picked = Number(answers.next.choice);

    return {
      broken: answers.broken.noul,
      deadEnd: answers.dead_end.noul,
      latencyMs,
      next: Number.isInteger(picked) ? picked : undefined,
      nextConfidence: answers.next.confidence,
    };
  };

  stats = () => {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;

    return { calls: sorted.length, max: at(1), p50: at(0.5), p95: at(0.95) };
  };
}
