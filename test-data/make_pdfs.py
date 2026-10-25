"""
Generates the two test PDFs used by the result-analysis upload flows.

  marks-text.pdf   - a real text-layer PDF (reportlab Helvetica text).
                      pdf-parse / pdf-parser can read it, so it exercises the
                      text-extraction branch of the upload pipeline.

  marks-image.pdf  - the same marks rendered as a raster image inside a PDF.
                      There is no text layer at all, so the pipeline must
                      detect it as a scanned document and route it to OCR.

Both files live next to this script in the test-data folder.
"""
import os

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))

# The header line has to name a roll-number column and a subject column,
# because both the PDF parser and the OCR parser look for that pattern.
HEADER = ["Roll No", "Subject Code", "Exam Type", "Marks", "Max Marks"]

ROWS = [
    ["TCS001", "CS101", "WRITTEN", "38", "45"],
    ["TCS002", "CS101", "WRITTEN", "42", "45"],
    ["TCS003", "CS101", "WRITTEN", "25", "45"],
    ["TCS004", "CS101", "WRITTEN", "0", "45"],
    ["TCS005", "CS101", "WRITTEN", "41", "45"],
    ["TCS006", "CS101", "WRITTEN", "17", "45"],
    ["TCS007", "CS101", "WRITTEN", "33", "45"],
    ["TCS008", "CS101", "WRITTEN", "45", "45"],
    ["TCS009", "CS101", "WRITTEN", "29", "45"],
    ["TCS010", "CS101", "WRITTEN", "36", "45"],
]

TITLE = "DBATU Result Analysis - Subject: CS101 (Data Structures)"


def build_text_pdf(path: str) -> None:
    """A PDF whose marks are real, selectable text."""
    page_w, page_h = A4
    c = canvas.Canvas(path, pagesize=A4)

    c.setFont("Helvetica-Bold", 14)
    c.drawString(20 * mm, page_h - 25 * mm, TITLE)

    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, page_h - 32 * mm, "Session 2024-25   |   Semester 1")

    # Header row. The two-space separated columns match the way the parser
    # splits PDF text lines into cells.
    table_x = 20 * mm
    table_y = page_h - 48 * mm
    col_w = 30 * mm

    c.setFont("Helvetica-Bold", 10)
    for i, head in enumerate(HEADER):
        c.drawString(table_x + i * col_w, table_y, head)

    c.setFont("Helvetica", 10)
    for r, row in enumerate(ROWS):
        y = table_y - (r + 1) * 7 * mm
        for i, cell in enumerate(row):
            c.drawString(table_x + i * col_w, y, cell)

    c.showPage()
    c.save()
    print(f"wrote {path}")


def build_image_pdf(path: str) -> None:
    """A PDF whose marks are pixels only - no extractable text layer."""
    width, height = 1240, 1754  # roughly A4 at 150 dpi
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    try:
        title_font = ImageFont.truetype("arialbd.ttf", 34)
        head_font = ImageFont.truetype("arialbd.ttf", 26)
        cell_font = ImageFont.truetype("arial.ttf", 26)
    except OSError:
        title_font = head_font = cell_font = ImageFont.load_default()

    draw.text((80, 90), "DBATU Result Analysis - Subject: CS101 (Data Structures)",
              fill="black", font=title_font)
    draw.text((80, 145), "Session 2024-25   |   Semester 1", fill="black", font=head_font)

    left = 80
    top = 240
    col_w = 210
    row_h = 62

    # Grid lines make it look like a scanned sheet.
    total_w = col_w * len(HEADER)
    total_h = row_h * (len(ROWS) + 1)
    for c in range(len(HEADER) + 1):
        x = left + c * col_w
        draw.line([(x, top), (x, top + total_h)], fill="black", width=2)
    for r in range(len(ROWS) + 2):
        y = top + r * row_h
        draw.line([(left, y), (left + total_w, y)], fill="black", width=2)

    for i, head in enumerate(HEADER):
        draw.text((left + i * col_w + 12, top + 16), head, fill="black", font=head_font)

    for r, row in enumerate(ROWS):
        y = top + (r + 1) * row_h + 16
        for i, cell in enumerate(row):
            draw.text((left + i * col_w + 12, y), cell, fill="black", font=cell_font)

    img.save(path, "PDF", resolution=150.0)
    print(f"wrote {path}")


if __name__ == "__main__":
    build_text_pdf(os.path.join(HERE, "marks-text.pdf"))
    build_image_pdf(os.path.join(HERE, "marks-image.pdf"))
