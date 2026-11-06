// 상태 판정 함수(embedding-status.ts, 구현 예정) 테스트 목록 — 계약: inote 레포 docs/todo/admin-embeddings.md "1단계 계약(확정)".
//
// 만들 함수(순수 함수, DB·네트워크 없음)
//   deriveEmbeddingStatus(post, ai | null) → EmbeddingStatus
//     post = { publishedAt, isPrivate, archivedAt, lastEditedAt }
//     ai   = { chunkCount, embeddedAt, job: { status, attempts, lastError } | null }  (AI 호출 실패면 null)
//   matchesFilter(status, filter) → boolean      (탭 필터: all | incomplete | failed | done | excluded)
//
// 접근 방법
//   - 순수 함수라 입력 객체만 바꿔 가며 기대 상태를 비교하면 된다. 우선순위 표(excluded > unknown > processing > failed > pending > incomplete > outdated > done)를
//     it.each로 한 번에 훑는 방법도 있다. 시각은 고정된 Date를 써서 10초 허용 오차 경계(9.9초/10초/10.1초)를 만든다.
//
// 가장 조심할 함정
//   - 우선순위: job이 failed인데 조각도 있고 embeddedAt이 최신이어도 failed가 이긴다 / excluded는 AI가 실패해도(ai = null) 여전히 excluded다.
//   - job.status가 done이면 job은 무시하고 chunkCount·시각으로 판정한다(done job이 남아 있는 글이 pending으로 오판되지 않게).
//   - 조각이 없는데 글 벡터만 있던 옛 글은 chunkCount 0 → incomplete 이다.
//   - outdated는 "embeddedAt < lastEditedAt - 10초" — 같은 시각, 임베딩이 몇 초 늦은 경우는 done. lastEditedAt이 null이면 outdated가 될 수 없다.

import {
  deriveEmbeddingStatus,
  matchesFilter,
  OUTDATED_TOLERANCE_MS,
  type EmbeddingFilter,
  type EmbeddingStatus,
  type PostForStatus,
} from './embedding-status';
import type { AiEmbeddingState } from '../../embeddings/inote-ai-embedding-status';

const T = new Date('2026-11-06T09:00:00.000Z');
const msBefore = (ms: number) => new Date(T.getTime() - ms).toISOString();

const post = (o: Partial<PostForStatus> = {}): PostForStatus => ({
  publishedAt: T,
  isPrivate: false,
  archivedAt: null,
  lastEditedAt: T,
  ...o,
});
const ai = (o: Partial<AiEmbeddingState> = {}): AiEmbeddingState => ({
  chunkCount: 3,
  embeddedAt: T.toISOString(),
  job: null,
  ...o,
});
const job = (
  status: 'pending' | 'processing' | 'done' | 'failed',
): AiEmbeddingState['job'] => ({ status, attempts: 1, lastError: null });

describe('deriveEmbeddingStatus', () => {
  describe('excluded (최우선)', () => {
    it('발행되지 않은 글(publishedAt null)은 excluded', () => {
      expect(deriveEmbeddingStatus(post({ publishedAt: null }), ai())).toBe(
        'excluded',
      );
    });
    it('비공개 글은 excluded', () => {
      expect(deriveEmbeddingStatus(post({ isPrivate: true }), ai())).toBe(
        'excluded',
      );
    });
    it('보관한 글(archivedAt 있음)은 excluded', () => {
      expect(deriveEmbeddingStatus(post({ archivedAt: T }), ai())).toBe(
        'excluded',
      );
    });
    it('AI 응답이 없어도(ai = null) excluded는 unknown이 아니라 excluded', () => {
      expect(deriveEmbeddingStatus(post({ isPrivate: true }), null)).toBe(
        'excluded',
      );
    });
    it('임베딩이 이미 있어도 비공개로 바뀐 글은 excluded', () => {
      expect(
        deriveEmbeddingStatus(
          post({ isPrivate: true }),
          ai({ chunkCount: 5, job: job('done') }),
        ),
      ).toBe('excluded');
    });
  });

  describe('unknown', () => {
    it('대상 글인데 ai가 null이면 unknown', () => {
      expect(deriveEmbeddingStatus(post(), null)).toBe('unknown');
    });
  });

  describe('job 상태 우선순위', () => {
    it('job.status가 processing이면 processing', () => {
      expect(
        deriveEmbeddingStatus(post(), ai({ job: job('processing') })),
      ).toBe('processing');
    });
    it('job.status가 failed이면 failed (조각이 있어도)', () => {
      expect(
        deriveEmbeddingStatus(
          post(),
          ai({ chunkCount: 3, job: job('failed') }),
        ),
      ).toBe('failed');
    });
    it('job.status가 pending이면 pending', () => {
      expect(deriveEmbeddingStatus(post(), ai({ job: job('pending') }))).toBe(
        'pending',
      );
    });
    it('job.status가 done이면 job은 무시하고 조각·시각으로 판정한다', () => {
      expect(deriveEmbeddingStatus(post(), ai({ job: job('done') }))).toBe(
        'done',
      );
      expect(
        deriveEmbeddingStatus(
          post(),
          ai({ chunkCount: 0, embeddedAt: null, job: job('done') }),
        ),
      ).toBe('incomplete');
    });
  });

  describe('incomplete / outdated / done', () => {
    it('조각이 0개이고 job도 없으면 incomplete', () => {
      expect(
        deriveEmbeddingStatus(post(), ai({ chunkCount: 0, embeddedAt: null })),
      ).toBe('incomplete');
    });
    it('조각이 있고 embeddedAt이 lastEditedAt보다 10초를 넘게 이전이면 outdated', () => {
      expect(
        deriveEmbeddingStatus(
          post(),
          ai({ embeddedAt: msBefore(OUTDATED_TOLERANCE_MS + 100) }),
        ),
      ).toBe('outdated');
    });
    it('embeddedAt이 lastEditedAt보다 10초 이내로 이전이면(허용 오차) done', () => {
      expect(
        deriveEmbeddingStatus(
          post(),
          ai({ embeddedAt: msBefore(OUTDATED_TOLERANCE_MS - 100) }),
        ),
      ).toBe('done');
      // 경계(정확히 10초)는 허용 오차 안이다
      expect(
        deriveEmbeddingStatus(
          post(),
          ai({ embeddedAt: msBefore(OUTDATED_TOLERANCE_MS) }),
        ),
      ).toBe('done');
    });
    it('embeddedAt이 lastEditedAt과 같거나 이후면 done', () => {
      expect(deriveEmbeddingStatus(post(), ai())).toBe('done');
      expect(
        deriveEmbeddingStatus(
          post(),
          ai({ embeddedAt: new Date(T.getTime() + 5000).toISOString() }),
        ),
      ).toBe('done');
    });
    it('lastEditedAt이 null이면 outdated가 되지 않고 done', () => {
      expect(
        deriveEmbeddingStatus(
          post({ lastEditedAt: null }),
          ai({ embeddedAt: msBefore(86_400_000) }),
        ),
      ).toBe('done');
    });
  });
});

describe('matchesFilter (탭)', () => {
  const ALL: EmbeddingStatus[] = [
    'excluded',
    'unknown',
    'processing',
    'pending',
    'failed',
    'incomplete',
    'outdated',
    'done',
  ];
  const passing = (filter: EmbeddingFilter) =>
    ALL.filter((status) => matchesFilter(status, filter));

  it('all은 모든 상태(unknown·excluded 포함)를 통과시킨다', () => {
    expect(passing('all')).toEqual(ALL);
  });
  it('incomplete 탭은 incomplete·outdated·pending·processing을 통과시키고 failed·done·excluded·unknown은 거른다', () => {
    expect(passing('incomplete').sort()).toEqual(
      ['incomplete', 'outdated', 'pending', 'processing'].sort(),
    );
  });
  it('failed 탭은 failed만 통과시킨다', () => {
    expect(passing('failed')).toEqual(['failed']);
  });
  it('done 탭은 done만 통과시킨다', () => {
    expect(passing('done')).toEqual(['done']);
  });
  it('excluded 탭은 excluded만 통과시킨다', () => {
    expect(passing('excluded')).toEqual(['excluded']);
  });
  it('unknown 글은 all 탭에서만 보이고 다른 탭에서는 보이지 않는다', () => {
    const tabs: EmbeddingFilter[] = [
      'all',
      'incomplete',
      'failed',
      'done',
      'excluded',
    ];
    expect(tabs.filter((tab) => matchesFilter('unknown', tab))).toEqual([
      'all',
    ]);
  });
});
