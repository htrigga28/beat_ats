"""Generate deterministic, single-column, ATS-friendly Word resumes."""

from __future__ import annotations

from io import BytesIO

from docx import Document
from docx.document import Document as DocumentObject
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from docx.text.run import Run

from schemas import ResumeDocument

BLACK = RGBColor(0, 0, 0)
FONT_NAME = "Arial"


def _set_run_font(run: Run, size: float, *, bold: bool = False) -> None:
    font = run.font
    font.name = FONT_NAME
    font.size = Pt(size)
    font.bold = bold
    font.color.rgb = BLACK
    properties = run._element.get_or_add_rPr()
    fonts = properties.get_or_add_rFonts()
    fonts.set(qn("w:ascii"), FONT_NAME)
    fonts.set(qn("w:hAnsi"), FONT_NAME)


def _configure_styles(document: DocumentObject) -> None:
    normal = document.styles["Normal"]
    normal.font.name = FONT_NAME
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = BLACK
    normal._element.rPr.rFonts.set(qn("w:ascii"), FONT_NAME)
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), FONT_NAME)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(2)
    normal.paragraph_format.line_spacing = 1.0

    styles = document.styles
    if "Resume Section" not in styles:
        style = styles.add_style("Resume Section", WD_STYLE_TYPE.PARAGRAPH)
    else:
        style = styles["Resume Section"]
    style.font.name = FONT_NAME
    style.font.size = Pt(11)
    style.font.bold = True
    style.font.color.rgb = BLACK
    style._element.rPr.rFonts.set(qn("w:ascii"), FONT_NAME)
    style._element.rPr.rFonts.set(qn("w:hAnsi"), FONT_NAME)
    style.paragraph_format.space_before = Pt(8)
    style.paragraph_format.space_after = Pt(3)
    style.paragraph_format.keep_with_next = True


def _add_numbering(document: DocumentObject) -> int:
    """Create a real Word bullet definition with compact resume geometry."""

    numbering = document.part.numbering_part.element
    abstract_ids = [
        int(element.get(qn("w:abstractNumId")))
        for element in numbering.findall(qn("w:abstractNum"))
    ]
    num_ids = [int(element.get(qn("w:numId"))) for element in numbering.findall(qn("w:num"))]
    abstract_id = max(abstract_ids, default=0) + 1
    num_id = max(num_ids, default=0) + 1

    abstract = OxmlElement("w:abstractNum")
    abstract.set(qn("w:abstractNumId"), str(abstract_id))
    multi_level = OxmlElement("w:multiLevelType")
    multi_level.set(qn("w:val"), "singleLevel")
    abstract.append(multi_level)

    level = OxmlElement("w:lvl")
    level.set(qn("w:ilvl"), "0")
    start = OxmlElement("w:start")
    start.set(qn("w:val"), "1")
    level.append(start)
    number_format = OxmlElement("w:numFmt")
    number_format.set(qn("w:val"), "bullet")
    level.append(number_format)
    level_text = OxmlElement("w:lvlText")
    level_text.set(qn("w:val"), "•")
    level.append(level_text)
    justification = OxmlElement("w:lvlJc")
    justification.set(qn("w:val"), "left")
    level.append(justification)

    paragraph_properties = OxmlElement("w:pPr")
    tabs = OxmlElement("w:tabs")
    tab = OxmlElement("w:tab")
    tab.set(qn("w:val"), "num")
    tab.set(qn("w:pos"), "360")
    tabs.append(tab)
    paragraph_properties.append(tabs)
    indentation = OxmlElement("w:ind")
    indentation.set(qn("w:left"), "360")
    indentation.set(qn("w:hanging"), "180")
    paragraph_properties.append(indentation)
    level.append(paragraph_properties)

    run_properties = OxmlElement("w:rPr")
    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), FONT_NAME)
    fonts.set(qn("w:hAnsi"), FONT_NAME)
    run_properties.append(fonts)
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "000000")
    run_properties.append(color)
    level.append(run_properties)
    abstract.append(level)
    numbering.append(abstract)

    number = OxmlElement("w:num")
    number.set(qn("w:numId"), str(num_id))
    abstract_reference = OxmlElement("w:abstractNumId")
    abstract_reference.set(qn("w:val"), str(abstract_id))
    number.append(abstract_reference)
    numbering.append(number)
    return num_id


def _add_section_heading(document: DocumentObject, title: str) -> None:
    paragraph = document.add_paragraph(style="Resume Section")
    paragraph.add_run(title.upper())


def _add_bullet(document: DocumentObject, text: str, num_id: int) -> None:
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(1.5)
    paragraph.paragraph_format.line_spacing = 1.0
    properties = paragraph._p.get_or_add_pPr()
    number_properties = OxmlElement("w:numPr")
    level = OxmlElement("w:ilvl")
    level.set(qn("w:val"), "0")
    number = OxmlElement("w:numId")
    number.set(qn("w:val"), str(num_id))
    number_properties.append(level)
    number_properties.append(number)
    properties.append(number_properties)
    run = paragraph.add_run(text)
    _set_run_font(run, 10.5)


def _add_labeled_line(document: DocumentObject, label: str, value: str) -> None:
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(1)
    label_run = paragraph.add_run(f"{label}: ")
    _set_run_font(label_run, 10.5, bold=True)
    value_run = paragraph.add_run(value)
    _set_run_font(value_run, 10.5)


def generate_resume_docx(resume: ResumeDocument) -> bytes:
    """Return a parseable Word document without ATS-hostile layout constructs."""

    document = Document()
    section = document.sections[0]
    section.start_type = WD_SECTION.NEW_PAGE
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.75)
    section.right_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.75)
    section.header_distance = Inches(0.3)
    section.footer_distance = Inches(0.3)
    _configure_styles(document)
    bullet_num_id = _add_numbering(document)

    properties = document.core_properties
    properties.title = "Tailored Resume"
    properties.author = ""
    properties.last_modified_by = ""
    properties.comments = ""
    properties.keywords = ""

    name = document.add_paragraph()
    name.alignment = WD_ALIGN_PARAGRAPH.CENTER
    name.paragraph_format.space_after = Pt(1)
    _set_run_font(name.add_run(resume.contact.full_name), 16, bold=True)

    contact_parts = [
        part
        for part in [
            resume.contact.location,
            resume.contact.phone,
            resume.contact.email,
            *resume.contact.links,
        ]
        if part
    ]
    if contact_parts:
        contact = document.add_paragraph()
        contact.alignment = WD_ALIGN_PARAGRAPH.CENTER
        contact.paragraph_format.space_after = Pt(5)
        _set_run_font(contact.add_run(" | ".join(contact_parts)), 9.5)

    if resume.professional_summary:
        _add_section_heading(document, "Professional Summary")
        paragraph = document.add_paragraph(resume.professional_summary)
        paragraph.paragraph_format.space_after = Pt(2)

    if resume.work_experience:
        _add_section_heading(document, "Work Experience")
        for role in resume.work_experience:
            heading = document.add_paragraph()
            heading.paragraph_format.space_before = Pt(2)
            heading.paragraph_format.space_after = Pt(0)
            heading.paragraph_format.keep_with_next = True
            _set_run_font(heading.add_run(role.title), 10.5, bold=True)
            _set_run_font(heading.add_run(f" | {role.employer}"), 10.5, bold=True)

            metadata = " | ".join(
                part
                for part in [
                    " - ".join(part for part in [role.start_date, role.end_date] if part),
                    role.location,
                ]
                if part
            )
            if metadata:
                paragraph = document.add_paragraph(metadata)
                paragraph.paragraph_format.space_after = Pt(1)
                _set_run_font(paragraph.runs[0], 9.5)
            for bullet in role.bullets:
                _add_bullet(document, bullet.text, bullet_num_id)

    if resume.skills:
        _add_section_heading(document, "Skills")
        for group in resume.skills:
            value = ", ".join(group.items)
            if group.label:
                _add_labeled_line(document, group.label, value)
            elif value:
                paragraph = document.add_paragraph(value)
                paragraph.paragraph_format.space_after = Pt(1)

    if resume.education:
        _add_section_heading(document, "Education")
        for education in resume.education:
            heading = document.add_paragraph()
            heading.paragraph_format.space_after = Pt(0)
            _set_run_font(heading.add_run(education.credential), 10.5, bold=True)
            if education.field_of_study:
                _set_run_font(heading.add_run(f", {education.field_of_study}"), 10.5)
            institution_parts = [education.institution, education.location, education.dates]
            institution_line = " | ".join(part for part in institution_parts if part)
            paragraph = document.add_paragraph(institution_line)
            paragraph.paragraph_format.space_after = Pt(1)
            for detail in education.details:
                _add_bullet(document, detail, bullet_num_id)

    if resume.certifications:
        _add_section_heading(document, "Certifications")
        for certification in resume.certifications:
            _add_bullet(document, certification, bullet_num_id)

    if resume.projects:
        _add_section_heading(document, "Projects")
        for project in resume.projects:
            heading = document.add_paragraph()
            heading.paragraph_format.space_after = Pt(0)
            _set_run_font(heading.add_run(project.name), 10.5, bold=True)
            metadata = " | ".join(
                part for part in [project.role, project.dates, project.link] if part
            )
            if metadata:
                paragraph = document.add_paragraph(metadata)
                paragraph.paragraph_format.space_after = Pt(1)
            for bullet in project.bullets:
                _add_bullet(document, bullet.text, bullet_num_id)

    for additional in resume.additional_sections:
        if not additional.items:
            continue
        _add_section_heading(document, additional.title)
        for item in additional.items:
            _add_bullet(document, item, bullet_num_id)

    output = BytesIO()
    document.save(output)
    return output.getvalue()
