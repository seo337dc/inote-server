import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RenameCategoryDto } from './rename-category.dto';

/**
 * RenameCategoryDto 검증 — 카테고리 이름 수정 요청 본문(name)의 규칙 (작업 #6)
 *
 * 규칙: 문자열 필수, 앞뒤 공백을 지운 뒤 1~50자
 *
 * 테스트 방법: 들어온 값(plain 객체)을 DTO 인스턴스로 바꾸고(plainToInstance),
 * 그 인스턴스를 검증(validate)해서 오류 목록이 비어 있는지 / 어떤 오류가 있는지 본다.
 * (실제 서버에서는 ValidationPipe가 같은 일을 해 준다)
 */
describe('RenameCategoryDto', () => {
  // 값을 DTO로 바꾸고 검증까지 한 결과를 돌려주는 도우미
  async function check(value: unknown) {
    const dto = plainToInstance(RenameCategoryDto, { name: value });
    const errors = await validate(dto);
    return { dto, errors };
  }

  it('1~50자 문자열이면 통과한다', async () => {
    // Act: 평범한 이름
    const { errors } = await check('공부');

    // Assert: 검증 오류가 하나도 없다
    expect(errors).toHaveLength(0);
  });

  it('앞뒤 공백은 지워진 값으로 바뀐다', async () => {
    // Act: 앞뒤에 공백이 붙은 이름
    const { dto, errors } = await check('  공부  ');

    // Assert: 오류는 없고, 서비스로 넘어가는 값은 공백이 정리된 '공부'다
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('공부');
  });

  it('공백만 있으면 정리 후 빈 문자열이라 실패한다', async () => {
    // Act: 공백만 있는 이름
    const { errors } = await check('   ');

    // Assert: 공백을 지우면 비어 있으므로 name에 대한 검증 오류가 나야 한다
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
  });

  it('빈 문자열이면 실패한다', async () => {
    // Act
    const { errors } = await check('');

    // Assert
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
  });

  it('50자는 통과하고 51자는 실패한다', async () => {
    // Act: 경계값 — 딱 50자와 51자
    const fifty = await check('가'.repeat(50));
    const fiftyOne = await check('가'.repeat(51));

    // Assert
    expect(fifty.errors).toHaveLength(0);
    expect(fiftyOne.errors).toHaveLength(1);
    expect(fiftyOne.errors[0].property).toBe('name');
  });

  it('name이 없으면 실패한다', async () => {
    // Act: 본문에 name 키가 아예 없다
    const dto = plainToInstance(RenameCategoryDto, {});
    const errors = await validate(dto);

    // Assert
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
  });

  it('name이 문자열이 아니면(숫자 등) 실패한다 — 공백 정리(@Transform)가 문자열이 아닌 값에서 터지지 않는다', async () => {
    // Act & Assert: 숫자가 들어와도 변환 단계에서 예외가 나면 안 되고(500 방지),
    // 검증 오류(400)로 정리되어야 한다
    const result = await check(123);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].property).toBe('name');
  });
});
