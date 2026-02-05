"""
QA Smoke Test — exercises all API endpoints against a running server.
Run: python scripts/qa_smoke_test.py [base_url]
Requires: the API running at base_url (default http://localhost:8000)
"""

import sys
import json
import time
import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
PASS = 0
FAIL = 0


def check(name: str, ok: bool, detail: str = ""):
    global PASS, FAIL
    status = "PASS" if ok else "FAIL"
    if not ok:
        FAIL += 1
    else:
        PASS += 1
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))


def run():
    client = httpx.Client(base_url=BASE, timeout=30)

    # ── Health ──
    print("\n=== Health ===")
    r = client.get("/health")
    check("GET /health", r.status_code == 200, r.text)

    # ── Auth ──
    print("\n=== Auth ===")
    # Signup
    r = client.post("/auth/signup", json={
        "email": "qatest@test.com", "password": "qapass123",
        "full_name": "QA Tester", "role": "transaction_coordinator",
    })
    check("POST /auth/signup (new user)", r.status_code == 201, r.text[:120])

    # Duplicate signup
    r2 = client.post("/auth/signup", json={
        "email": "qatest@test.com", "password": "qapass123",
        "full_name": "QA Tester", "role": "transaction_coordinator",
    })
    check("POST /auth/signup (duplicate)", r2.status_code == 400)

    # Login
    r = client.post("/auth/login", json={"email": "qatest@test.com", "password": "qapass123"})
    check("POST /auth/login", r.status_code == 200 and "access_token" in r.json())
    token = r.json().get("access_token", "")
    headers = {"Authorization": f"Bearer {token}"}

    # Me
    r = client.get("/auth/me", headers=headers)
    check("GET /auth/me", r.status_code == 200 and r.json()["email"] == "qatest@test.com")

    # No auth
    r = client.get("/auth/me")
    check("GET /auth/me (no auth)", r.status_code in (401, 403))

    # ── Deals ──
    print("\n=== Deals ===")
    r = client.post("/deals", json={"title": "QA Test Deal", "address": "123 QA St"}, headers=headers)
    check("POST /deals", r.status_code == 201)
    deal_id = r.json()["id"]

    r = client.get("/deals", headers=headers)
    check("GET /deals", r.status_code == 200 and len(r.json()) > 0)

    r = client.get(f"/deals/{deal_id}", headers=headers)
    check("GET /deals/:id", r.status_code == 200 and r.json()["id"] == deal_id)

    # ── RBAC: agent cannot create deal ──
    print("\n=== RBAC ===")
    client.post("/auth/signup", json={
        "email": "qaagent@test.com", "password": "agentpass",
        "full_name": "QA Agent", "role": "buyer_agent",
    })
    r = client.post("/auth/login", json={"email": "qaagent@test.com", "password": "agentpass"})
    agent_token = r.json().get("access_token", "")
    agent_headers = {"Authorization": f"Bearer {agent_token}"}

    r = client.post("/deals", json={"title": "Bad Deal"}, headers=agent_headers)
    check("POST /deals (agent blocked)", r.status_code == 403)

    # Assign agent to deal
    r = client.get("/auth/me", headers=agent_headers)
    agent_id = r.json()["id"]
    r = client.post(f"/deals/{deal_id}/assign", json={"user_id": agent_id, "role_in_deal": "buyer_agent"}, headers=headers)
    check("POST /deals/:id/assign", r.status_code == 201)

    # Agent can now access deal
    r = client.get(f"/deals/{deal_id}", headers=agent_headers)
    check("GET /deals/:id (agent after assign)", r.status_code == 200)

    # ── Contract Paste ──
    print("\n=== Contract Ingestion ===")
    contract_text = (
        "FLORIDA AS-IS RESIDENTIAL CONTRACT FOR SALE AND PURCHASE\n\n"
        "Purchase Price: $350,000.00\n"
        "Closing Date: July 15, 2025\n"
        "Inspection Period: 15 days\n"
        "Earnest Money: $10,000.00\n"
        "Financing: Conventional\n"
        "Title Company: First American Title\n"
    )
    r = client.post(f"/deals/{deal_id}/contract/paste", json={"text": contract_text}, headers=headers)
    check("POST /deals/:id/contract/paste", r.status_code == 201)
    paste_result = r.json()
    parse_job_id = paste_result.get("job_id", "")

    # Poll parse job
    if parse_job_id:
        for _ in range(15):
            time.sleep(1)
            r = client.get(f"/jobs/{parse_job_id}", headers=headers)
            if r.status_code == 200 and r.json()["status"] in ("completed", "failed"):
                break
        check("Parse job completed", r.json().get("status") == "completed", r.json().get("status", ""))

    r = client.get(f"/deals/{deal_id}/contract/current", headers=headers)
    check("GET /deals/:id/contract/current", r.status_code == 200)
    current = r.json()
    check("Contract has extracted_fields", current.get("extracted_fields") is not None)

    # ── Change Requests ──
    print("\n=== Change Requests ===")
    r = client.post(f"/deals/{deal_id}/change-requests",
                    json={"raw_text": "Reduce the purchase price to $340,000 and extend closing by 2 weeks"},
                    headers=headers)
    check("POST /deals/:id/change-requests", r.status_code == 201)
    cr_id = r.json()["id"]

    r = client.get(f"/deals/{deal_id}/change-requests", headers=headers)
    check("GET /deals/:id/change-requests", r.status_code == 200 and len(r.json()) > 0)

    # Analyze
    r = client.post(f"/deals/{deal_id}/change-requests/{cr_id}/analyze", headers=headers)
    check("POST analyze", r.status_code == 200)
    analyze_job_id = r.json().get("job_id", "")

    if analyze_job_id:
        for _ in range(15):
            time.sleep(1)
            r = client.get(f"/jobs/{analyze_job_id}", headers=headers)
            if r.status_code == 200 and r.json()["status"] in ("completed", "failed"):
                break
        check("Analyze job completed", r.json().get("status") == "completed", r.json().get("status", ""))

    r = client.get(f"/deals/{deal_id}/change-requests/{cr_id}", headers=headers)
    check("CR has analysis_result", r.json().get("analysis_result") is not None)
    analysis = r.json().get("analysis_result", {})
    check("Analysis has recommendation", "recommendation" in analysis, analysis.get("recommendation", ""))
    check("Analysis has changes array", isinstance(analysis.get("changes"), list))

    # ── Version Generation ──
    print("\n=== Version Generation ===")
    r = client.post(f"/deals/{deal_id}/versions/generate",
                    json={"change_request_id": cr_id}, headers=headers)
    check("POST generate version", r.status_code == 200)
    gen_job_id = r.json().get("job_id", "")

    if gen_job_id:
        for _ in range(20):
            time.sleep(1)
            r = client.get(f"/jobs/{gen_job_id}", headers=headers)
            if r.status_code == 200 and r.json()["status"] in ("completed", "failed"):
                break
        check("Generate job completed", r.json().get("status") == "completed", r.json().get("status", ""))

    r = client.get(f"/deals/{deal_id}/versions", headers=headers)
    check("GET versions", r.status_code == 200)
    versions = r.json()
    check("At least 2 versions (v0 + v1)", len(versions) >= 2, f"count={len(versions)}")

    # Diff
    if len(versions) >= 2:
        v1_id = [v for v in versions if v["version_number"] == 1]
        if v1_id:
            r = client.get(f"/deals/{deal_id}/versions/{v1_id[0]['id']}/diff?against=prev", headers=headers)
            check("GET diff v1 vs v0", r.status_code == 200)
            check("Diff has content", len(r.json().get("diff_html", "")) > 0)

    # ── Timeline + Audit ──
    print("\n=== Timeline & Audit ===")
    r = client.get(f"/deals/{deal_id}/timeline", headers=headers)
    check("GET timeline", r.status_code == 200)
    check("Timeline has events", len(r.json().get("events", [])) > 0, f"count={len(r.json().get('events', []))}")

    r = client.get(f"/deals/{deal_id}/audit", headers=headers)
    check("GET audit (TC)", r.status_code == 200 and len(r.json()) > 0)

    # Agent cannot access audit
    r = client.get(f"/deals/{deal_id}/audit", headers=agent_headers)
    check("GET audit (agent blocked)", r.status_code == 403)

    # ── LLM Usage placeholder ──
    print("\n=== LLM Usage ===")
    r = client.get("/llm-usage")
    check("GET /llm-usage", r.status_code == 200 and "columns" in r.json())

    # ── Summary ──
    print(f"\n{'='*50}")
    print(f"TOTAL: {PASS + FAIL} | PASS: {PASS} | FAIL: {FAIL}")
    if FAIL > 0:
        print("STATUS: SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("STATUS: ALL TESTS PASSED")


if __name__ == "__main__":
    run()
