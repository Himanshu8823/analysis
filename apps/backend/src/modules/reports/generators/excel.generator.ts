import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import { CalculatorFactory } from '../../marks/calculator/calculator.factory';
import type { Subject, Mark } from '@prisma/client';

export interface ReportFilters {
  branchId: string;
  schemeId: string;
  semester: number;
  academicYearId: string;
}

interface StudentRowResult {
  rollNo: string;
  name: string;
  totalObtained: number;
  totalMax: number;
  overallPercentage: number;
  isOverallPass: boolean;
  earnedCredits: number;
  totalCredits: number;
  perSubject: Map<string, { obtained: number; max: number; percentage: number; isPass: boolean }>;
}

/**
 * Generates multi-sheet Excel workbooks for the DBATU result analysis.
 *
 * Sheets produced for "COMPLETE" reports:
 *  1. Student_Wise_Result
 *  2. Scheme_Wise_Marks
 *  3. Subject_Analysis
 *  4. Student_Analysis
 *  5. Class_Toppers
 *  6. Pass_Fail_Analysis
 *  7. Charts_Data
 */
@Injectable()
export class ExcelReportGenerator {
  private readonly logger = new Logger(ExcelReportGenerator.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly factory: CalculatorFactory,
  ) {}

  async generateCompleteReport(filters: ReportFilters): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'DBATU Result Analysis System';
    wb.created = new Date();

    const data = await this.loadContext(filters);
    await this.addStudentWiseSheet(wb, data);
    await this.addSchemeWiseSheet(wb, data);
    await this.addSubjectAnalysisSheet(wb, data);
    await this.addStudentAnalysisSheet(wb, data);
    await this.addClassToppersSheet(wb, data);
    await this.addPassFailSheet(wb, data);
    await this.addChartsDataSheet(wb, data);

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private async loadContext(filters: ReportFilters): Promise<{
    subjects: Subject[];
    students: Awaited<ReturnType<PrismaClient['student']['findMany']>>;
    marks: Mark[];
    rows: Map<string, StudentRowResult>;
    schemeName: string;
  }> {
    const scheme = await this.prisma.scheme.findUnique({
      where: { id: filters.schemeId },
    });
    if (!scheme) {
      throw new Error(`Scheme ${filters.schemeId} not found`);
    }
    const calc = this.factory.fromScheme(scheme);

    const subjects = await this.prisma.subject.findMany({
      where: {
        branchId: filters.branchId,
        schemeId: filters.schemeId,
        semester: filters.semester,
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    const students = await this.prisma.student.findMany({
      where: {
        branchId: filters.branchId,
        schemeId: filters.schemeId,
        semester: filters.semester,
        academicYearId: filters.academicYearId,
        isActive: true,
      },
      orderBy: { rollNo: 'asc' },
    });

    const marks = await this.prisma.mark.findMany({
      where: {
        academicYearId: filters.academicYearId,
        student: {
          branchId: filters.branchId,
          schemeId: filters.schemeId,
          semester: filters.semester,
        },
      },
      include: { subject: true },
    });

    // Compute per-student result using scheme-aware calculator
    const marksByStudent = new Map<string, Mark[]>();
    for (const m of marks) {
      const list = marksByStudent.get(m.studentId) ?? [];
      list.push(m as Mark);
      marksByStudent.set(m.studentId, list);
    }

    const rows = new Map<string, StudentRowResult>();
    for (const student of students) {
      const studentMarks = marksByStudent.get(student.id) ?? [];
      const result = calc.calculateStudentResult(
        student.id,
        studentMarks,
        subjects,
      );
      const perSubject = new Map<
        string,
        { obtained: number; max: number; percentage: number; isPass: boolean }
      >();
      for (const sub of result.subjectResults) {
        perSubject.set(sub.subjectId, {
          obtained: sub.totalObtained,
          max: sub.totalMax,
          percentage: sub.percentage,
          isPass: sub.isPass,
        });
      }
      rows.set(student.id, {
        rollNo: student.rollNo,
        name: student.name,
        totalObtained: result.totalObtained,
        totalMax: result.totalMax,
        overallPercentage: result.overallPercentage,
        isOverallPass: result.isOverallPass,
        earnedCredits: result.earnedCredits,
        totalCredits: result.totalCredits,
        perSubject,
      });
    }

    return { subjects, students, marks, rows, schemeName: scheme.name };
  }

  // -------------------------------------------------------------------------
  // Sheet builders
  // -------------------------------------------------------------------------

  private async addStudentWiseSheet(
    wb: ExcelJS.Workbook,
    data: Awaited<ReturnType<ExcelReportGenerator['loadContext']>>,
  ): Promise<void> {
    const sheet = wb.addWorksheet('Student_Wise_Result');
    const header: string[] = [
      'Roll No',
      'Name',
      ...data.subjects.map((s) => s.code),
      'Total',
      'Percentage',
      'Result',
    ];
    sheet.addRow(header);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD0D0D0' },
    };
    sheet.views = [{ state: 'frozen', xSplit: 2 }];
    sheet.columns = header.map((h) => ({ width: Math.max(h.length + 2, 14) }));

    for (const student of data.students) {
      const row = data.rows.get(student.id);
      if (!row) continue;
      const cells: (string | number)[] = [
        row.rollNo,
        row.name,
        ...data.subjects.map((s) => {
          const sub = row.perSubject.get(s.id);
          return sub ? sub.obtained : 0;
        }),
        row.totalObtained,
        `${row.overallPercentage.toFixed(2)}%`,
        row.isOverallPass ? 'PASS' : 'FAIL',
      ];
      sheet.addRow(cells);
    }
  }

  private async addSchemeWiseSheet(
    wb: ExcelJS.Workbook,
    data: Awaited<ReturnType<ExcelReportGenerator['loadContext']>>,
  ): Promise<void> {
    const sheet = wb.addWorksheet('Scheme_Wise_Marks');
    sheet.columns = [
      { width: 16 },
      { width: 18 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ];
    sheet.addRow(['Scheme', 'Subject Code', 'Subject Name', 'Max Marks', 'Credits', 'Pass Marks', 'Has Practical']);
    sheet.getRow(1).font = { bold: true };

    for (const sub of data.subjects) {
      const comps = sub.components as { hasPractical?: boolean } | null;
      sheet.addRow([
        data.schemeName,
        sub.code,
        sub.name,
        sub.maxMarks,
        sub.credits,
        sub.passingMarks,
        comps?.hasPractical ? 'Y' : 'N',
      ]);
    }
  }

  private async addSubjectAnalysisSheet(
    wb: ExcelJS.Workbook,
    data: Awaited<ReturnType<ExcelReportGenerator['loadContext']>>,
  ): Promise<void> {
    const sheet = wb.addWorksheet('Subject_Analysis');
    sheet.columns = [
      { width: 16 },
      { width: 26 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 18 },
    ];
    sheet.addRow([
      'Subject Code',
      'Subject Name',
      'Students',
      'Average %',
      'Highest %',
      'Lowest %',
      'Pass %',
      'Difficulty',
    ]);
    sheet.getRow(1).font = { bold: true };

    for (const sub of data.subjects) {
      const studentScores = data.students
        .map((s) => data.rows.get(s.id)?.perSubject.get(sub.id))
        .filter((v): v is { obtained: number; max: number; percentage: number; isPass: boolean } =>
          Boolean(v && v.max > 0),
        );

      if (studentScores.length === 0) {
        sheet.addRow([sub.code, sub.name, 0, '-', '-', '-', '-', '-']);
        continue;
      }

      const total = studentScores.length;
      const avg =
        studentScores.reduce((sum, v) => sum + v.percentage, 0) / total;
      const highest = Math.max(...studentScores.map((v) => v.percentage));
      const lowest = Math.min(...studentScores.map((v) => v.percentage));
      const passCount = studentScores.filter((v) => v.isPass).length;
      const passPct = (passCount / total) * 100;
      const difficulty = avg >= 70 ? 'Easy' : avg >= 50 ? 'Moderate' : 'Hard';

      sheet.addRow([
        sub.code,
        sub.name,
        total,
        `${avg.toFixed(2)}%`,
        `${highest.toFixed(2)}%`,
        `${lowest.toFixed(2)}%`,
        `${passPct.toFixed(2)}%`,
        difficulty,
      ]);
    }
  }

  private async addStudentAnalysisSheet(
    wb: ExcelJS.Workbook,
    data: Awaited<ReturnType<ExcelReportGenerator['loadContext']>>,
  ): Promise<void> {
    const sheet = wb.addWorksheet('Student_Analysis');
    sheet.columns = [
      { width: 16 },
      { width: 24 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
    ];
    sheet.addRow([
      'Roll No',
      'Name',
      'Total Marks',
      'Total Max',
      'Percentage',
      'Earned Credits',
      'Result',
    ]);
    sheet.getRow(1).font = { bold: true };

    for (const student of data.students) {
      const row = data.rows.get(student.id);
      if (!row) continue;
      sheet.addRow([
        row.rollNo,
        row.name,
        row.totalObtained,
        row.totalMax,
        `${row.overallPercentage.toFixed(2)}%`,
        `${row.earnedCredits}/${row.totalCredits}`,
        row.isOverallPass ? 'PASS' : 'FAIL',
      ]);
    }
  }

  private async addClassToppersSheet(
    wb: ExcelJS.Workbook,
    data: Awaited<ReturnType<ExcelReportGenerator['loadContext']>>,
  ): Promise<void> {
    const sheet = wb.addWorksheet('Class_Toppers');
    sheet.columns = [
      { width: 8 },
      { width: 16 },
      { width: 24 },
      { width: 16 },
      { width: 16 },
    ];
    sheet.addRow(['Rank', 'Roll No', 'Name', 'Total Marks', 'Percentage']);
    sheet.getRow(1).font = { bold: true };

    const sorted = [...data.rows.values()].sort(
      (a, b) => b.overallPercentage - a.overallPercentage,
    );
    sorted.slice(0, 20).forEach((row, idx) => {
      sheet.addRow([
        idx + 1,
        row.rollNo,
        row.name,
        row.totalObtained,
        `${row.overallPercentage.toFixed(2)}%`,
      ]);
    });
  }

  private async addPassFailSheet(
    wb: ExcelJS.Workbook,
    data: Awaited<ReturnType<ExcelReportGenerator['loadContext']>>,
  ): Promise<void> {
    const sheet = wb.addWorksheet('Pass_Fail_Analysis');
    sheet.columns = [{ width: 22 }, { width: 14 }, { width: 14 }];
    sheet.addRow(['Metric', 'Count', 'Percentage']);
    sheet.getRow(1).font = { bold: true };

    const totalStudents = data.rows.size;
    const passed = [...data.rows.values()].filter((r) => r.isOverallPass).length;
    const failed = totalStudents - passed;
    const distinction = [...data.rows.values()].filter((r) => r.overallPercentage >= 75).length;
    const firstClass = [...data.rows.values()].filter(
      (r) => r.overallPercentage >= 60 && r.overallPercentage < 75,
    ).length;
    const secondClass = [...data.rows.values()].filter(
      (r) => r.overallPercentage >= 50 && r.overallPercentage < 60,
    ).length;

    const fmt = (n: number) =>
      totalStudents > 0 ? `${((n / totalStudents) * 100).toFixed(2)}%` : '0%';
    sheet.addRow(['Total Students', totalStudents, '100%']);
    sheet.addRow(['Pass', passed, fmt(passed)]);
    sheet.addRow(['Fail', failed, fmt(failed)]);
    sheet.addRow(['Distinction (>=75%)', distinction, fmt(distinction)]);
    sheet.addRow(['First Class (60-74.99%)', firstClass, fmt(firstClass)]);
    sheet.addRow(['Second Class (50-59.99%)', secondClass, fmt(secondClass)]);
  }

  private async addChartsDataSheet(
    wb: ExcelJS.Workbook,
    data: Awaited<ReturnType<ExcelReportGenerator['loadContext']>>,
  ): Promise<void> {
    const sheet = wb.addWorksheet('Charts_Data');
    sheet.columns = [{ width: 16 }, { width: 16 }];
    sheet.addRow(['Bucket', 'Count']);
    sheet.getRow(1).font = { bold: true };

    const buckets = {
      'Distinction (>=75%)': 0,
      'First Class (60-74%)': 0,
      'Second Class (50-59%)': 0,
      'Pass (40-49%)': 0,
      'Fail (<40%)': 0,
    };
    for (const r of data.rows.values()) {
      const p = r.overallPercentage;
      if (p >= 75) buckets['Distinction (>=75%)']++;
      else if (p >= 60) buckets['First Class (60-74%)']++;
      else if (p >= 50) buckets['Second Class (50-59%)']++;
      else if (p >= 40) buckets['Pass (40-49%)']++;
      else buckets['Fail (<40%)']++;
    }
    for (const [k, v] of Object.entries(buckets)) {
      sheet.addRow([k, v]);
    }
  }
}
