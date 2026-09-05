"""Tests for the compliance rule engine."""
import pytest

from app.models.entities import ScanSeverity
from app.services.rule_engine import evaluate_compliance, REGEX_RULES


class TestRuleEngine:
    def test_compliant_label(self):
        """A fully compliant label passes all mandatory checks."""
        text = """
        MRP: Rs. 120.00
        NET WT. 500g
        MANUFACTURED BY: ABC Foods Pvt Ltd
        BEST BEFORE: 12/2027
        CUSTOMER CARE: 1800-123-4567
        PACKED AT: Plot 42, MIDC, Pune 411045
        LIC. NO. 12345678901234
        BATCH NO. F23B001
        """
        report = evaluate_compliance(text)

        assert report.verdict == ScanSeverity.PASS
        assert report.score == 100.0
        assert report.extracted_fields["mrp"] == "120.00"
        assert report.extracted_fields["net_quantity"] == "500g"
        assert "ABC Foods" in report.extracted_fields["manufacturer"]

    def test_empty_label_gets_all_violations(self):
        report = evaluate_compliance("")
        assert report.score == 0.0
        assert report.verdict == ScanSeverity.CRITICAL
        keys = {r.key for r in report.results}
        assert keys == set(REGEX_RULES.keys())

    def test_missing_critical_fields(self):
        """Missing MRP & net quantity must elevate verdict to critical."""
        text = """
        MANUFACTURED BY: Yummy Snacks Co.
        BEST BEFORE: Jan 2027
        CUSTOMER CARE: 1800-123-4567
        """
        report = evaluate_compliance(text)
        assert report.verdict == ScanSeverity.CRITICAL
        mrp = next(r for r in report.results if r.key == "mrp")
        qty = next(r for r in report.results if r.key == "net_quantity")
        assert mrp.status == ScanSeverity.CRITICAL
        assert qty.status == ScanSeverity.CRITICAL

    def test_malformed_mrp(self):
        """An extracted MRP that fails semantic validation is marked minor."""
        text = """
        MRP: Rs. 0.00
        NET WT. 250g
        """
        report = evaluate_compliance(text)
        mrp = next(r for r in report.results if r.key == "mrp")
        assert mrp.status == ScanSeverity.MINOR

    def test_inr_rupee_symbol_mrp(self):
        text = """
        MRP (incl. all taxes): ₹99
        NET WT. 250g
        """
        report = evaluate_compliance(text)
        assert report.extracted_fields["mrp"] == "99"

    def test_net_quantity_variants(self):
        for variant in [
            "NET QTY. 1 L",
            "NET WEIGHT 50 ml",
            "Net Content 2kg",
        ]:
            report = evaluate_compliance(f"{variant}\nMRP: 50")
            assert report.extracted_fields["net_quantity"], variant

    def test_customer_care_1800_toll_free(self):
        text = """
        CUSTOMER CARE NO: 1800-419-1111
        MRP: 50.00
        """
        report = evaluate_compliance(text)
        assert report.extracted_fields["customer_care"]

    def test_fssai_and_batch_detected(self):
        text = """
        FSSAI LICENSE NO: 12345678901234
        LOT NUMBER: L-2024-88
        MRP: 10.00
        """
        report = evaluate_compliance(text)
        assert report.extracted_fields["fssai"] == "12345678901234"
        assert "L-2024-88" in report.extracted_fields["batch_number"]

    def test_no_false_positive_without_keywords(self):
        text = "This is a label with numbers 120 and 500g but no compliance wording."
        report = evaluate_compliance(text)
        assert report.verdict == ScanSeverity.CRITICAL
        assert "mrp" not in report.extracted_fields


class TestScoring:
    def test_score_is_bounded(self):
        report = evaluate_compliance("MRP: 1\nNET WT. 1g")
        assert 0.0 <= report.score <= 100.0

    def test_severity_rank(self):
        text = """
        MRP: Rs. 99.00
        NET WT. 450g
        MANUFACTURED BY: Test Manufacturer Pvt. Ltd.
        """
        report = evaluate_compliance(text)
        # MRP, quantity & manufacturer present; expiry missing -> major
        assert report.verdict == ScanSeverity.MAJOR