"""Tests for the compliance rule engine."""
import pytest

from app.models.entities import ScanSeverity
from app.services.rule_engine import evaluate_compliance, REGEX_RULES


class TestRuleEngine:
    def test_compliant_label(self):
        """A fully compliant label passes all mandatory checks."""
        text = """
        Aachar Rice
        MRP: Rs. 120.00 (INCL. OF ALL TAXES)
        NET WT. 500g
        MANUFACTURED BY: ABC Foods Pvt Ltd
        MFG DATE: 05/2026
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
        assert report.extracted_fields["commodity_name"] == "Rice"
        assert report.extracted_fields["mfg_date"] == "05/2026"
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

    def test_mrp_without_tax_declaration_is_minor(self):
        """Rule 6(1)(e): MRP must be declared inclusive of all taxes."""
        text = "MRP: Rs. 99.00\nNET WT. 200 g"
        report = evaluate_compliance(text)
        mrp = next(r for r in report.results if r.key == "mrp")
        assert mrp.status == ScanSeverity.MINOR
        assert "inclusive of all taxes" in mrp.message

    def test_misleading_quantity_qualifier_is_minor(self):
        """Rule 12(6): quantity must not be qualified by 'about / minimum' etc."""
        text = "MRP: Rs. 40.00 (INCL OF ALL TAXES)\nNET QUANTITY: about 500g"
        report = evaluate_compliance(text)
        qty = next(r for r in report.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.MINOR

    def test_commodity_name_required(self):
        """Rule 6(1)(b): common/generic name of the commodity must appear."""
        text = """
        MRP: Rs. 40.00 (INCL OF ALL TAXES)
        NET WT. 1 kg
        MANUFACTURED BY: ABC Foods Pvt Ltd
        """
        report = evaluate_compliance(text)
        name = next(r for r in report.results if r.key == "commodity_name")
        assert name.status == ScanSeverity.MAJOR

    def test_mfg_month_year_detected(self):
        """Rule 6(1)(d): month & year of manufacture/pre-packing must be stated."""
        text = "MRP: Rs. 12.00 (INCL OF ALL TAXES)\nNET WT. 100 g\nMFG DATE: 06/2026"
        report = evaluate_compliance(text)
        assert report.extracted_fields["mfg_date"] == "06/2026"

    def test_product_name_and_mfg_date_not_misdetected_clauses(self):
        """'MANUFACTURED BY' / 'PACKED AT' must not satisfy mfg_date."""
        text = """
        MRP: Rs. 30.00 (INCL. OF ALL TAXES)
        NET WT. 500g
        MANUFACTURED BY: XYZ Ltd
        PACKED AT: Pune
        """
        report = evaluate_compliance(text)
        assert "mfg_date" not in report.extracted_fields

    def test_standard_pack_size_ok(self):
        """Rule 5 / Second Schedule: 1 kg rice is a standard size."""
        text = "Rice\nMRP: Rs. 80.00 (INCL OF ALL TAXES)\nNET WT. 1 kg"
        report = evaluate_compliance(text)
        qty = next(r for r in report.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.PASS

    def test_non_standard_pack_size_minor(self):
        """Rule 5 / Second Schedule: 300 g rice is not a standard size."""
        text = "Rice\nMRP: Rs. 40.00 (INCL OF ALL TAXES)\nNET WT. 300g"
        report = evaluate_compliance(text)
        qty = next(r for r in report.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.MINOR
        assert "non-standard" in qty.message

    def test_unknown_commodity_not_penalised_for_pack_size(self):
        text = "Premium Widget\nMRP: Rs. 20.00 (INCL OF ALL TAXES)\nNET WT. 300g"
        report = evaluate_compliance(text)
        qty = next(r for r in report.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.PASS

    def test_water_pack_sizes(self):
        ok = evaluate_compliance("Mineral Water\nMRP: Rs. 30.00 (INCL OF ALL TAXES)\nNET QUANTITY: 2 litre")
        qty = next(r for r in ok.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.PASS
        bad = evaluate_compliance("Mineral Water\nMRP: Rs. 30.00 (INCL OF ALL TAXES)\nNET QUANTITY: 2.5 litre")
        qty = next(r for r in bad.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.MINOR

    def test_si_quantity_units_rule13(self):
        """Rule 13(2): <1 kg -> gram, <1 L -> millilitre."""
        bad_kg = evaluate_compliance("Rice\nMRP: Rs. 20 (INCL OF ALL TAXES)\nNET WT. 0.5 kg")
        qty = next(r for r in bad_kg.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.MINOR
        assert "Rule 13" in qty.message

        bad_l = evaluate_compliance("Mineral Water\nMRP: Rs. 30 (INCL OF ALL TAXES)\nNET QUANTITY: 0.75 litre")
        qty = next(r for r in bad_l.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.MINOR

        ok = evaluate_compliance("Rice\nMRP: Rs. 20 (INCL OF ALL TAXES)\nNET WT. 500 g")
        qty = next(r for r in ok.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.PASS

    def test_when_packed_rule11(self):
        """Rule 11(4): only soaps/lotions/creams may be qualified by 'when packed'."""
        bad = evaluate_compliance("Rice\nMRP: Rs. 20 (INCL OF ALL TAXES)\nNET WT. 500 g WHEN PACKED")
        qty = next(r for r in bad.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.MINOR
        assert "when packed" in qty.message

        soap_ok = evaluate_compliance("Toilet Soap\nMRP: Rs. 50 (INCL OF ALL TAXES)\nNET WT. 100 g WHEN PACKED")
        qty = next(r for r in soap_ok.results if r.key == "net_quantity")
        assert qty.status == ScanSeverity.PASS

    def test_detergent_label_realistic_ocr(self):
        """Regression for a real liquid-detergent label: OCR-noise batch, typed
        commodity name, manufacturer without 'MANUFACTURED BY' keyword, and
        non-food (best-before / FSSAI not required)."""
        text = """
DOSE into eysrinshorgh w w mm
TREAT^ ingestedthn seek medic ice.Rinse ans r
SUITABLE FOR ALLTEMPERATURE SETINGS.
NET QUANTITY:
POUR Rs.185.00Rs.0.19/mL
MADE IN INDIA RECRO8025-000-07AAACP4072C22 (PGHPPL)
4987176336163> 2138/318
Ligid Laundry Deergent.
OCCAREONE RODUCSPRIVATELIMITED POAAS 66000
"""
        report = evaluate_compliance(text)
        by_key = {r.key: r for r in report.results}

        # OCR garbage must not be treated as a batch number
        batch = by_key["batch_number"]
        assert "eysrinshorgh" not in (batch.extracted_value or "")
        assert batch.status == ScanSeverity.PASS

        # Commodity name recovered despite the OCR typo
        assert by_key["commodity_name"].status == ScanSeverity.PASS

        # Manufacturer detected via company-suffix (public limited) even without a keyword
        mfg = by_key["manufacturer"]
        assert mfg.status == ScanSeverity.PASS

        # Best-before & FSSAI are not required on a non-food package
        assert by_key["dates"].status == ScanSeverity.PASS
        assert by_key["fssai"].status == ScanSeverity.PASS

    def test_food_package_still_requires_best_before_and_fssai(self):
        text = "Rice\nMRP: Rs. 80.00 (INCL OF ALL TAXES)\nNET WT. 1 kg\nMANUFACTURED BY: ABC Foods Pvt Ltd"
        report = evaluate_compliance(text)
        by_key = {r.key: r for r in report.results}
        assert by_key["dates"].status == ScanSeverity.MAJOR
        assert by_key["fssai"].status == ScanSeverity.MINOR


class TestMpe:
    def test_table1_values(self):
        from app.services.rule_engine import max_permissible_error
        cases = {
            50: 4.5, 100: 4.5, 200: 9.0, 300: 9.0, 500: 15.0,
            1000: 15.0, 5000: 75.0, 10000: 150.0, 15000: 150.0, 20000: 200.0,
        }
        for declared, expected in cases.items():
            assert max_permissible_error(declared) == expected, declared

    def test_mpe_report(self):
        from app.services.rule_engine import compute_mpe_report
        report = compute_mpe_report("500g")
        assert report and report[0]["basis"] == "Weight/Volume"
        assert report[0]["max_permissible_error"] == 15.0
        assert compute_mpe_report(None) is None
        table2 = compute_mpe_report("10 pcs")
        assert table2 and len(table2) == 3


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