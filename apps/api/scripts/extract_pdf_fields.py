"""
PDF Field Extraction Utility

Usage:
    python scripts/extract_pdf_fields.py <path_to_pdf>

This script extracts all form fields from a PDF template and outputs them
as JSON for creating field mappings.
"""
import fitz
import json
import sys
from pathlib import Path


def extract_fields(pdf_path: str) -> dict:
    """Extract all form fields from PDF template."""
    doc = fitz.open(pdf_path)
    fields = {
        "pdf_file": str(Path(pdf_path).name),
        "total_pages": len(doc),
        "text_fields": [],
        "checkbox_fields": [],
        "radio_fields": [],
        "other_fields": [],
    }

    for page_num, page in enumerate(doc):
        for widget in page.widgets():
            field_info = {
                "name": widget.field_name,
                "type": widget.field_type_string,
                "page": page_num,
                "rect": [round(x, 2) for x in widget.rect],
                "width": round(widget.rect.width, 2),
                "height": round(widget.rect.height, 2),
            }

            # Add current value if present
            if widget.field_value:
                field_info["current_value"] = widget.field_value

            # Categorize by type
            if widget.field_type == fitz.PDF_WIDGET_TYPE_TEXT:
                fields["text_fields"].append(field_info)
            elif widget.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                fields["checkbox_fields"].append(field_info)
            elif widget.field_type == fitz.PDF_WIDGET_TYPE_RADIOBUTTON:
                fields["radio_fields"].append(field_info)
            else:
                field_info["field_type_code"] = widget.field_type
                fields["other_fields"].append(field_info)

    doc.close()

    # Add summary
    fields["summary"] = {
        "text_fields_count": len(fields["text_fields"]),
        "checkbox_fields_count": len(fields["checkbox_fields"]),
        "radio_fields_count": len(fields["radio_fields"]),
        "other_fields_count": len(fields["other_fields"]),
        "total_fields": (
            len(fields["text_fields"])
            + len(fields["checkbox_fields"])
            + len(fields["radio_fields"])
            + len(fields["other_fields"])
        ),
    }

    return fields


def generate_mapping_template(fields: dict) -> dict:
    """Generate a starter mapping template from extracted fields."""
    mapping = {
        "template_slug": "far_bar_template",
        "template_version": "UNKNOWN",
        "pdf_file": "pdfs/" + fields["pdf_file"],
        "field_mappings": {
            "text_fields": {},
            "checkbox_fields": {},
        },
        "signature_fields": [],
    }

    # Add text field stubs
    for field in fields["text_fields"]:
        name = field["name"]
        # Try to guess a reasonable key name
        key = name.lower().replace(" ", "_").replace("-", "_")
        mapping["field_mappings"]["text_fields"][key] = {
            "pdf_field_name": name,
            "transform": None,
            "format": None,
        }

    # Add checkbox field stubs
    for field in fields["checkbox_fields"]:
        name = field["name"]
        key = name.lower().replace(" ", "_").replace("-", "_")
        mapping["field_mappings"]["checkbox_fields"][key] = {
            "pdf_field_name": name,
            "condition": f"{key} == true",
        }

    return mapping


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/extract_pdf_fields.py <path_to_pdf> [--mapping]")
        print("\nOptions:")
        print("  --mapping    Also generate a starter mapping template")
        sys.exit(1)

    pdf_path = sys.argv[1]
    generate_mapping = "--mapping" in sys.argv

    if not Path(pdf_path).exists():
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)

    try:
        fields = extract_fields(pdf_path)
        print("=== EXTRACTED FIELDS ===")
        print(json.dumps(fields, indent=2))

        if generate_mapping:
            print("\n\n=== STARTER MAPPING TEMPLATE ===")
            mapping = generate_mapping_template(fields)
            print(json.dumps(mapping, indent=2))

    except Exception as e:
        print(f"Error extracting fields: {e}")
        sys.exit(1)
