"""
PDF Form Filler Service for FAR/BAR contracts.

This service fills official FAR/BAR PDF forms with deal data,
ensuring legal compliance by using official templates.
"""
import fitz
import json
import logging
import base64
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


class PDFFormFillerError(Exception):
    """Raised when PDF form filling fails."""
    pass


class PDFFormFiller:
    """Service for filling official FAR/BAR PDF forms."""

    def __init__(self, templates_dir: Path = TEMPLATES_DIR):
        self.templates_dir = templates_dir
        self._mappings_cache: Dict[str, dict] = {}

    def get_available_templates(self) -> List[dict]:
        """List available PDF templates."""
        mappings_dir = self.templates_dir / "mappings"
        if not mappings_dir.exists():
            return []

        templates = []
        for mapping_file in mappings_dir.glob("*.json"):
            try:
                with open(mapping_file) as f:
                    mapping = json.load(f)
                    templates.append({
                        "slug": mapping.get("template_slug", mapping_file.stem),
                        "version": mapping.get("template_version", "UNKNOWN"),
                        "name": mapping.get("template_name", mapping_file.stem),
                        "pdf_file": mapping.get("pdf_file", ""),
                    })
            except Exception as e:
                logger.warning(f"Failed to load mapping {mapping_file}: {e}")

        return templates

    def get_mapping(self, template_slug: str) -> dict:
        """Load field mapping for template."""
        if template_slug not in self._mappings_cache:
            mapping_path = self.templates_dir / "mappings" / f"{template_slug}.json"
            if not mapping_path.exists():
                raise PDFFormFillerError(f"Mapping not found: {template_slug}")
            with open(mapping_path) as f:
                self._mappings_cache[template_slug] = json.load(f)
        return self._mappings_cache[template_slug]

    def fill_pdf(
        self,
        template_slug: str,
        deal_data: dict,
        flatten: bool = False
    ) -> Tuple[bytes, List[str]]:
        """
        Fill PDF template with deal data.

        Args:
            template_slug: Template identifier (e.g., "far_bar_asis")
            deal_data: Dictionary with deal/contract fields
            flatten: If True, make form non-editable

        Returns:
            Tuple of (filled_pdf_bytes, list_of_warnings)
        """
        mapping = self.get_mapping(template_slug)
        pdf_path = self.templates_dir / mapping["pdf_file"]

        if not pdf_path.exists():
            raise PDFFormFillerError(f"PDF template not found: {pdf_path}")

        warnings = []
        doc = fitz.open(str(pdf_path))

        try:
            # Fill text fields
            for field_key, config in mapping.get("field_mappings", {}).get("text_fields", {}).items():
                value = self._get_nested_value(deal_data, field_key)
                if value is not None:
                    try:
                        self._fill_text_field(doc, config, value)
                    except Exception as e:
                        warnings.append(f"Failed to fill {field_key}: {e}")

            # Fill checkbox fields
            for field_key, config in mapping.get("field_mappings", {}).get("checkbox_fields", {}).items():
                try:
                    checked = self._evaluate_condition(config["condition"], deal_data)
                    self._fill_checkbox(doc, config["pdf_field_name"], checked)
                except Exception as e:
                    warnings.append(f"Failed to fill checkbox {field_key}: {e}")

            # Fill calculated fields
            for field_key, config in mapping.get("field_mappings", {}).get("calculated_fields", {}).items():
                try:
                    value = self._evaluate_formula(config["formula"], deal_data)
                    formatted = self._format_value(value, config.get("format"))
                    self._fill_text_field(doc, config, formatted)
                except Exception as e:
                    warnings.append(f"Failed to calculate {field_key}: {e}")

            if flatten:
                for page in doc:
                    for widget in page.widgets():
                        widget.field_flags = fitz.PDF_FIELD_IS_READ_ONLY
                        widget.update()

            pdf_bytes = doc.tobytes()

        finally:
            doc.close()

        return pdf_bytes, warnings

    def fill_pdf_base64(
        self,
        template_slug: str,
        deal_data: dict,
        flatten: bool = False
    ) -> Tuple[str, List[str]]:
        """
        Fill PDF and return as base64 string.

        Args:
            template_slug: Template identifier
            deal_data: Dictionary with deal/contract fields
            flatten: If True, make form non-editable

        Returns:
            Tuple of (base64_encoded_pdf, list_of_warnings)
        """
        pdf_bytes, warnings = self.fill_pdf(template_slug, deal_data, flatten)
        return base64.b64encode(pdf_bytes).decode("utf-8"), warnings

    def _get_nested_value(self, data: dict, key: str) -> Any:
        """Get value from nested dict using dot notation."""
        keys = key.split(".")
        value = data
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return None
        return value

    def _fill_text_field(self, doc: fitz.Document, config: dict, value: Any):
        """Fill a text field with auto-sizing."""
        field_name = config["pdf_field_name"]

        # Apply transforms
        if isinstance(value, str):
            transform = config.get("transform")
            if transform == "uppercase":
                value = value.upper()
            elif transform == "lowercase":
                value = value.lower()
            elif transform == "title":
                value = value.title()

        # Format value
        formatted = self._format_value(
            value,
            config.get("format"),
            config.get("date_format")
        )

        # Find and fill field
        for page in doc:
            for widget in page.widgets():
                if widget.field_name == field_name:
                    # Auto-size font if needed
                    max_font = config.get("max_font_size", 10)
                    min_font = config.get("min_font_size", 6)

                    widget.field_value = str(formatted)

                    # Calculate appropriate font size
                    font_size = self._calculate_font_size(
                        widget.rect, str(formatted), max_font, min_font
                    )
                    widget.text_fontsize = font_size
                    widget.update()
                    return

        # Field not found - this is logged as debug, not warning
        logger.debug(f"PDF field not found: {field_name}")

    def _fill_checkbox(self, doc: fitz.Document, field_name: str, checked: bool):
        """Fill a checkbox field."""
        for page in doc:
            for widget in page.widgets():
                if widget.field_name == field_name:
                    # Common checkbox values: "Yes", "On", "True", or "Off", ""
                    widget.field_value = "Yes" if checked else "Off"
                    widget.update()
                    return

        logger.debug(f"Checkbox field not found: {field_name}")

    def _format_value(
        self,
        value: Any,
        format_type: Optional[str] = None,
        date_format: Optional[str] = None
    ) -> str:
        """Format value based on type."""
        if value is None:
            return ""

        if format_type == "currency":
            try:
                num_value = float(value)
                return f"${num_value:,.2f}"
            except (ValueError, TypeError):
                return str(value)

        elif format_type == "currency_no_cents":
            try:
                num_value = float(value)
                return f"${num_value:,.0f}"
            except (ValueError, TypeError):
                return str(value)

        elif format_type == "number":
            try:
                num_value = float(value)
                return f"{num_value:,.0f}"
            except (ValueError, TypeError):
                return str(value)

        elif format_type == "percent":
            try:
                num_value = float(value)
                return f"{num_value:.2f}%"
            except (ValueError, TypeError):
                return str(value)

        elif format_type == "date":
            output_format = date_format or "%B %d, %Y"
            if isinstance(value, str):
                # Try to parse various date formats
                for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%B %d, %Y"]:
                    try:
                        dt = datetime.strptime(value, fmt)
                        return dt.strftime(output_format)
                    except ValueError:
                        continue
            elif isinstance(value, datetime):
                return value.strftime(output_format)
            return str(value)

        elif format_type == "phone":
            # Format as (XXX) XXX-XXXX
            digits = "".join(filter(str.isdigit, str(value)))
            if len(digits) == 10:
                return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
            return str(value)

        return str(value)

    def _calculate_font_size(
        self,
        rect: fitz.Rect,
        text: str,
        max_size: int,
        min_size: int
    ) -> int:
        """Calculate optimal font size to fit text in field."""
        if not text:
            return max_size

        # Approximate character width factor (varies by font)
        # Courier-like: ~0.6, Arial-like: ~0.5
        char_width_factor = 0.55

        for size in range(max_size, min_size - 1, -1):
            chars_per_line = rect.width / (size * char_width_factor)
            if len(text) <= chars_per_line:
                return size

        return min_size

    def _evaluate_condition(self, condition: str, data: dict) -> bool:
        """
        Safely evaluate a condition string.

        Supports:
        - "field == 'value'"
        - "field == true/false"
        - "field != 'value'"
        - "field"  (truthy check)
        """
        condition = condition.strip()

        # Handle comparison operators
        for op in ["==", "!="]:
            if op in condition:
                parts = condition.split(op)
                if len(parts) != 2:
                    return False

                field = parts[0].strip()
                expected = parts[1].strip().strip("'\"")
                actual = self._get_nested_value(data, field)

                # Handle boolean literals
                if expected.lower() == "true":
                    result = bool(actual)
                elif expected.lower() == "false":
                    result = not bool(actual)
                else:
                    result = str(actual) == expected

                return result if op == "==" else not result

        # Simple truthy check
        return bool(self._get_nested_value(data, condition))

    def _evaluate_formula(self, formula: str, data: dict) -> float:
        """
        Safely evaluate a simple arithmetic formula.

        Supports: +, -, *, /, parentheses, and field references.
        """
        # Build a safe evaluation context
        result = formula

        # Replace field names with values (longer names first to avoid partial replacement)
        sorted_keys = sorted(data.keys(), key=len, reverse=True)
        for key in sorted_keys:
            if key in result:
                value = data.get(key)
                # Handle None and non-numeric values
                if value is None:
                    value = 0
                try:
                    value = float(value)
                except (ValueError, TypeError):
                    value = 0
                result = result.replace(key, str(value))

        # Handle "or 0" patterns for optional fields
        result = result.replace(" or 0", "")

        # Safe eval with only math operations
        try:
            # Only allow numbers, operators, parentheses, and spaces
            allowed_chars = set("0123456789.+-*/() ")
            if not all(c in allowed_chars for c in result):
                logger.warning(f"Invalid formula characters: {result}")
                return 0.0
            return float(eval(result, {"__builtins__": {}}, {}))
        except Exception as e:
            logger.warning(f"Formula evaluation failed: {formula} -> {result}: {e}")
            return 0.0


# Singleton instance
pdf_filler = PDFFormFiller()
