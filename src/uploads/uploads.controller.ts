import { randomUUID } from 'crypto';
import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { R2Service } from './r2.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// 글 이미지의 확장자는 사용자 파일명이 아니라 검증을 통과한 MIME에서 정한다
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const imageFilePipe = () =>
  new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES }),
      new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
    ],
  });

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly r2: R2Service) {}

  @Post('image')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: '이미지 업로드 (로그인 필요) — R2에 저장 후 공개 URL 반환',
  })
  async uploadImage(
    @CurrentUser() user: { id: string },
    @UploadedFile(imageFilePipe()) file: Express.Multer.File,
  ) {
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const key = `uploads/${user.id}/${randomUUID()}.${ext}`;
    const url = await this.r2.upload(key, file.buffer, file.mimetype);
    return { url };
  }

  // 글 에디터 이미지 — 먼저 tmp에 올리고, 글을 저장(발행)할 때 BlogService가 post/<userId>/<postId>/로 옮긴다.
  // 계약: docs/EDITOR_IMAGE_UPLOAD.md (inote 레포)
  @Post('post-image')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      '글 이미지 임시 업로드 (로그인 필요) — R2 tmp/에 저장 후 공개 URL 반환, 글 저장 때 영구 위치로 승격',
  })
  async uploadPostImage(
    @CurrentUser() user: { id: string },
    @UploadedFile(imageFilePipe()) file: Express.Multer.File,
  ) {
    const key = `tmp/post/${user.id}/${randomUUID()}.${EXT_BY_MIME[file.mimetype]}`;
    const url = await this.r2.upload(key, file.buffer, file.mimetype);
    return { url };
  }
}
