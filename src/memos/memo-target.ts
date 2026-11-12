// 메모의 종류 — 글(post)·독서 기록(reading)에 붙는 메모, 그리고 대상 없는 일반 메모(general). DB에는 문자열로 저장하고 값은 DTO에서 검증한다.
export const MEMO_TARGET_TYPES = ['post', 'reading', 'general'] as const;
export type MemoTargetType = (typeof MEMO_TARGET_TYPES)[number];

// 일반 메모(general)에는 대상이 없어 targetId를 이 값으로 고정해 저장한다 — 클라이언트가 보낸 targetId는 무시한다
export const GENERAL_TARGET_ID = '';

// 메모 한 장의 최대 글자 수 (FE의 MEMO_MAX_LENGTH와 같아야 한다)
export const MEMO_MAX_LENGTH = 10000;

// 메모 제목의 최대 글자 수 (FE의 MEMO_TITLE_MAX_LENGTH와 같아야 한다)
export const MEMO_TITLE_MAX_LENGTH = 30;

// 대상(글·독서 기록) 하나에 만들 수 있는 메모 수 — 일반 메모는 전체 합쳐서 이 값. 넘으면 409 (FE의 MEMO_MAX_COUNT와 같아야 한다)
export const MEMO_MAX_COUNT = 10;
