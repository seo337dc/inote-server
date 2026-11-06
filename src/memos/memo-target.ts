// 메모를 붙일 수 있는 대상 — 글(post)과 독서 기록(reading). DB에는 문자열로 저장하고 값은 DTO에서 검증한다.
export const MEMO_TARGET_TYPES = ['post', 'reading'] as const;
export type MemoTargetType = (typeof MEMO_TARGET_TYPES)[number];

// 메모 한 장의 최대 글자 수 (FE의 MEMO_MAX_LENGTH와 같아야 한다)
export const MEMO_MAX_LENGTH = 10000;
