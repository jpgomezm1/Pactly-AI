"""Tests for PDF Form Filler Service."""
import pytest
from pathlib import Path
from datetime import datetime

from services.pdf_form_filler import PDFFormFiller, PDFFormFillerError


@pytest.fixture
def filler():
    """Create a PDFFormFiller instance with test templates dir."""
    templates_dir = Path(__file__).parent.parent / "templates"
    return PDFFormFiller(templates_dir=templates_dir)


class TestPDFFormFiller:
    """Tests for PDFFormFiller class."""

    def test_get_available_templates(self, filler):
        """Test listing available templates."""
        templates = filler.get_available_templates()
        # Should have at least the far_bar_asis template mapping
        assert isinstance(templates, list)
        # Check if far_bar_asis mapping exists (even without PDF)
        slugs = [t["slug"] for t in templates]
        assert "far_bar_asis" in slugs

    def test_get_mapping_exists(self, filler):
        """Test loading an existing mapping."""
        mapping = filler.get_mapping("far_bar_asis")
        assert mapping is not None
        assert mapping["template_slug"] == "far_bar_asis"
        assert "field_mappings" in mapping
        assert "text_fields" in mapping["field_mappings"]

    def test_get_mapping_not_found(self, filler):
        """Test loading a non-existent mapping."""
        with pytest.raises(PDFFormFillerError) as exc:
            filler.get_mapping("nonexistent_template")
        assert "Mapping not found" in str(exc.value)

    def test_format_value_currency(self, filler):
        """Test currency formatting."""
        assert filler._format_value(350000, "currency") == "$350,000.00"
        assert filler._format_value(1234.56, "currency") == "$1,234.56"
        assert filler._format_value(0, "currency") == "$0.00"
        assert filler._format_value("invalid", "currency") == "invalid"

    def test_format_value_currency_no_cents(self, filler):
        """Test currency formatting without cents."""
        assert filler._format_value(350000, "currency_no_cents") == "$350,000"
        assert filler._format_value(1234.56, "currency_no_cents") == "$1,235"

    def test_format_value_number(self, filler):
        """Test number formatting."""
        assert filler._format_value(1000000, "number") == "1,000,000"
        assert filler._format_value(1234.56, "number") == "1,235"

    def test_format_value_percent(self, filler):
        """Test percent formatting."""
        assert filler._format_value(6.5, "percent") == "6.50%"
        assert filler._format_value(7.125, "percent") == "7.12%"

    def test_format_value_date(self, filler):
        """Test date formatting."""
        # ISO format input
        assert filler._format_value("2024-03-15", "date") == "March 15, 2024"
        # US format input
        assert filler._format_value("03/15/2024", "date") == "March 15, 2024"
        # Custom output format
        assert filler._format_value("2024-03-15", "date", "%m/%d/%Y") == "03/15/2024"
        # datetime object
        dt = datetime(2024, 3, 15)
        assert filler._format_value(dt, "date") == "March 15, 2024"

    def test_format_value_phone(self, filler):
        """Test phone formatting."""
        assert filler._format_value("3055551234", "phone") == "(305) 555-1234"
        assert filler._format_value("305-555-1234", "phone") == "(305) 555-1234"
        assert filler._format_value("(305) 555-1234", "phone") == "(305) 555-1234"
        # Invalid length returns original
        assert filler._format_value("12345", "phone") == "12345"

    def test_format_value_none(self, filler):
        """Test None value formatting."""
        assert filler._format_value(None, "currency") == ""
        assert filler._format_value(None, None) == ""

    def test_evaluate_condition_equality(self, filler):
        """Test condition evaluation with equality."""
        data = {"financing_type": "Cash", "inspection_contingency": True}

        assert filler._evaluate_condition("financing_type == 'Cash'", data) is True
        assert filler._evaluate_condition("financing_type == 'Conventional'", data) is False
        assert filler._evaluate_condition("financing_type != 'Cash'", data) is False
        assert filler._evaluate_condition("financing_type != 'Conventional'", data) is True

    def test_evaluate_condition_boolean(self, filler):
        """Test condition evaluation with booleans."""
        data = {"inspection_contingency": True, "appraisal_contingency": False}

        assert filler._evaluate_condition("inspection_contingency == true", data) is True
        assert filler._evaluate_condition("inspection_contingency == false", data) is False
        assert filler._evaluate_condition("appraisal_contingency == true", data) is False
        assert filler._evaluate_condition("appraisal_contingency == false", data) is True

    def test_evaluate_condition_truthy(self, filler):
        """Test simple truthy condition."""
        data = {"has_value": "something", "empty_value": "", "none_value": None}

        assert filler._evaluate_condition("has_value", data) is True
        assert filler._evaluate_condition("empty_value", data) is False
        assert filler._evaluate_condition("none_value", data) is False
        assert filler._evaluate_condition("missing_key", data) is False

    def test_evaluate_formula_simple(self, filler):
        """Test simple formula evaluation."""
        data = {"purchase_price": 350000, "earnest_money": 10000}

        result = filler._evaluate_formula("purchase_price - earnest_money", data)
        assert result == 340000.0

    def test_evaluate_formula_with_optional(self, filler):
        """Test formula with optional fields."""
        data = {"purchase_price": 350000, "earnest_money": 10000, "additional_deposit": 5000}

        result = filler._evaluate_formula(
            "purchase_price - earnest_money - (additional_deposit or 0)", data
        )
        assert result == 335000.0

        # Without additional_deposit
        data2 = {"purchase_price": 350000, "earnest_money": 10000}
        result2 = filler._evaluate_formula(
            "purchase_price - earnest_money - (additional_deposit or 0)", data2
        )
        assert result2 == 340000.0

    def test_get_nested_value(self, filler):
        """Test nested value retrieval."""
        data = {
            "buyer": {"name": "John", "address": {"city": "Miami"}},
            "price": 350000,
        }

        assert filler._get_nested_value(data, "price") == 350000
        assert filler._get_nested_value(data, "buyer.name") == "John"
        assert filler._get_nested_value(data, "buyer.address.city") == "Miami"
        assert filler._get_nested_value(data, "missing") is None
        assert filler._get_nested_value(data, "buyer.missing") is None

    def test_calculate_font_size(self, filler):
        """Test font size calculation."""

        class MockRect:
            def __init__(self, width):
                self.width = width

        # Short text should use max size
        rect = MockRect(200)
        size = filler._calculate_font_size(rect, "Short", 10, 6)
        assert size == 10

        # Long text should reduce size
        long_text = "This is a very long piece of text that needs to fit"
        size = filler._calculate_font_size(rect, long_text, 10, 6)
        assert size < 10

        # Empty text uses max size
        size = filler._calculate_font_size(rect, "", 10, 6)
        assert size == 10


class TestPDFFormFillerIntegration:
    """Integration tests that require the actual PDF template."""

    @pytest.mark.skip(reason="Requires actual PDF template file")
    def test_fill_pdf_basic(self, filler):
        """Test filling a PDF with basic data."""
        deal_data = {
            "buyer_name": "John Smith",
            "seller_name": "Jane Doe",
            "property_address": "123 Main St, Miami, FL 33101",
            "purchase_price": 350000,
            "earnest_money": 10000,
            "closing_date": "2024-06-15",
            "financing_type": "Conventional",
            "inspection_contingency": True,
        }

        pdf_bytes, warnings = filler.fill_pdf("far_bar_asis", deal_data)

        # Should return valid PDF bytes
        assert pdf_bytes is not None
        assert len(pdf_bytes) > 0
        assert pdf_bytes[:4] == b"%PDF"  # PDF magic bytes

    @pytest.mark.skip(reason="Requires actual PDF template file")
    def test_fill_pdf_base64(self, filler):
        """Test filling a PDF and returning base64."""
        deal_data = {"buyer_name": "Test Buyer"}

        pdf_base64, warnings = filler.fill_pdf_base64("far_bar_asis", deal_data)

        # Should return valid base64 string
        assert pdf_base64 is not None
        assert isinstance(pdf_base64, str)
        # Should be decodable
        import base64
        decoded = base64.b64decode(pdf_base64)
        assert decoded[:4] == b"%PDF"
