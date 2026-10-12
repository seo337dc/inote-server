// 비슷한 글 쿼리 DTO(SimilarPostsQueryDto) 테스트 목록 — 구현은 직접 채운다.
// 준비: plainToInstance(SimilarPostsQueryDto, { limit: '3' }) 후 validate() (쿼리는 항상 문자열로 온다)
describe('SimilarPostsQueryDto', () => {
  it.todo('limit이 없으면 기본값 5');
  it.todo('1, 5, 10은 통과하고 숫자로 변환된다');
  it.todo('0, 11, -1은 실패한다 (범위 1~10)');
  it.todo('abc, 2.5, 빈 문자열은 실패한다 (정수만)');
});
