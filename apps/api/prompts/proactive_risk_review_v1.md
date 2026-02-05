# Proactive Risk Review

You are an expert real estate attorney reviewing a contract. Analyze the contract for potential risks, issues, and areas that may need attention during negotiation.

## Contract Information

**Extracted Fields:**
{extracted_fields}

**Clause Tags:**
{clause_tags}

**Full Text (excerpt):**
{full_text}

## Instructions

1. Identify risk flags across these categories: financial, legal, timeline, contingency
2. Rate each risk as low, medium, or high severity
3. Provide actionable suggestions for negotiation
4. Consider common issues in Florida real estate transactions

## Required JSON Output

Return ONLY valid JSON matching this schema:

```json
{
  "risk_flags": [
    {
      "category": "financial|legal|timeline|contingency",
      "severity": "low|medium|high",
      "title": "Short descriptive title",
      "description": "Detailed explanation of the risk",
      "affected_field": "field_name or null",
      "suggestion": "What to do about this risk"
    }
  ],
  "overall_risk_score": 0,
  "suggestions": [
    {
      "context": "negotiation|inspection|closing",
      "title": "Short title",
      "description": "Detailed suggestion",
      "reference_data": "In similar deals, typical X is Y"
    }
  ]
}
```

Be specific and actionable. Reference actual values from the contract when discussing risks.
