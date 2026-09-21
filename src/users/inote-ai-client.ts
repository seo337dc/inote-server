import { Logger } from '@nestjs/common';

// inote-ai는 별도 DB라 여기서 직접 지워달라고 호출해야 함. 실패 여부를 boolean으로
// 반환해서, 호출하는 쪽(본인 탈퇴/관리자 삭제)이 각자 정책에 맞게 처리하도록 함
// (본인 탈퇴는 실패해도 계속 진행, 관리자 삭제는 실패 시 화면에 알림).
export async function deleteInoteAiData(
  userId: string,
  logger: Logger,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${process.env.INOTE_AI_URL}/sessions?user_id=${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: { 'x-internal-secret': process.env.INTERNAL_SECRET ?? '' },
      },
    );
    if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);
    return true;
  } catch (e) {
    logger.warn(`failed to delete inote-ai data for user ${userId}: ${e}`);
    return false;
  }
}
