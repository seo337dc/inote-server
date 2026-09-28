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
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const key = `uploads/${user.id}/${randomUUID()}.${ext}`;
    const url = await this.r2.upload(key, file.buffer, file.mimetype);
    return { url };
  }
}
