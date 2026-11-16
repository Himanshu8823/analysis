/**
 * The sample scheme document.
 *
 * Reading a syllabus PDF is not obvious to a first-time user. What kind of
 * file works? What should it look like? A paragraph of instructions answers
 * neither question as well as a file the user can open and look at.
 *
 * So this service serves a real syllabus PDF — the university's own
 * First-Year Computer Engineering scheme, downloaded from the official
 * website — as a download. The user can open it, see the table the reader
 * is looking for, and upload the same kind of file.
 *
 * It is deliberately the *same document* the reader is tested against. A
 * sample that the reader could not read would be worse than no sample at
 * all: the user would download it, upload it, and be told the file had no
 * readable text, having learned nothing about the format they need.
 *
 * The file is a *fixed asset*. It is read from the application's own
 * directory and served as-is. Nothing is uploaded, nothing is stored, and
 * no user can write to it.
 */

import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';

/**
 * The folders the sample may be found in.
 *
 * The file sits in the application's own `assets` folder, and the folder
 * moves relative to the running code depending on how the application is
 * started:
 *
 *  - `npm run dev` runs from the source tree, so `assets` is a sibling of
 *    `src` — one level above the compiled file's `modules/scheme-reader`.
 *  - `npm run start:prod` runs from `dist`, where the build copies
 *    `assets` to `dist/assets` — again one level above `modules/scheme-reader`.
 *
 * The working directory is tried as well, because a deployment may run the
 * process from anywhere.
 *
 * The list is walked in order and the first file that exists wins, so the
 * same build serves the same document in every mode.
 */
const SAMPLE_LOCATIONS = [
  resolve(__dirname, '..', '..', 'assets', 'sample-scheme.pdf'),
  resolve(__dirname, '..', '..', '..', 'assets', 'sample-scheme.pdf'),
  resolve(process.cwd(), 'assets', 'sample-scheme.pdf'),
  resolve(process.cwd(), '..', 'assets', 'sample-scheme.pdf'),
];

/**
 * The name the file is offered under.
 */
const SAMPLE_FILE_NAME = 'sample-scheme.pdf';

/**
 * Serves the sample syllabus PDF.
 *
 * The route is public: the document is published by the university, and a
 * browser download link cannot carry a sign-in token, so requiring one
 * would break the one thing this route exists for.
 */
@Controller('scheme-reader')
@ApiTags('Scheme Reader')
export class SampleDocumentController {
  /**
   * The sample document, read once and kept in memory.
   *
   * The file never changes while the application runs, so it is read once
   * rather than on every request.
   */
  private cached: Buffer | null = null;

  /**
   * Downloads the sample syllabus PDF.
   *
   * Public. The document is a university publication, and a browser
   * download link cannot carry a bearer token — so requiring a sign-in
   * here would break the one thing this route exists for.
   *
   * The response is written through the raw response object rather than
   * returned, because the global transform interceptor wraps every
   * returned value in a JSON envelope — and a JSON envelope around a PDF
   * is a corrupt PDF. The report download does the same.
   */
  @Public()
  @Get('sample')
  @ApiOperation({
    summary: 'Download a sample syllabus PDF showing the format the reader understands',
  })
  async sample(@Res() res: Response): Promise<void> {
    const buffer = await this.load();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${SAMPLE_FILE_NAME}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  /**
   * The sample document's bytes, read once and kept in memory.
   *
   * The file never changes while the application runs, so it is read once
   * rather than on every request.
   */
  private async load(): Promise<Buffer> {
    if (this.cached) return this.cached;

    for (const location of SAMPLE_LOCATIONS) {
      if (!existsSync(location)) continue;

      this.cached = await readFile(location);
      return this.cached;
    }

    throw new NotFoundException(
      'The sample document is not available on this system. Download the scheme PDF from the university website instead.'
    );
  }
}
