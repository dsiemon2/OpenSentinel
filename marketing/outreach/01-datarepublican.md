# DataRepublican — X Direct Message

**Platform**: X (Twitter) DM
**Handle**: @DataRepublican
**Status**: She follows @OpenSentinel
**Attachment**: Graph.png (C:\Users\dsiem\Downloads\Products\Graph.png)

---

Hey — saw your OSINT pipeline tweet about Snyder. Sending you a screenshot of something I built that I think is right in your wheelhouse.

[ATTACH Graph.png]

This is OpenSentinel's Knowledge Graph. What you're looking at:

- 102 entities, 110 relationships, pulled from 12 data sources — all cross-referenced automatically
- The blue nodes are people (George Soros, Nancy Pelosi, etc.), green are organizations (Palantir, Open Society Foundation, NovaTech Labs), pink are contracts (DoD Procurement), cyan are locations
- Every edge has a labeled relationship: "donated to", "funded", "manages", "related to", "works on"
- Top right you can switch between Network view, Financial Flow (follow the money), and Memory view
- The time slider on the right lets you scrub through when entities were discovered — watch the investigation build in real time

The data comes from built-in integrations with:
- FEC — individual & committee donations (search by name, employer, date range, amount)
- SEC EDGAR — 10-K, 10-Q, 8-K filings, insider transactions
- IRS 990 — nonprofit returns via ProPublica (revenue, officers, grants, highest-paid employees)
- USASpending — federal contracts & grants
- OpenCorporates — business registrations across jurisdictions
- FRED — 800K+ macroeconomic time series (GDP, CPI, M2, federal funds rate, unemployment, federal debt — anything the Fed tracks)

You ask it something like "show me all FEC donations from executives at Palantir to any PAC, then cross-reference those PAC officers with IRS 990 nonprofit boards" — and it builds this graph. Multi-hop traversal. Each query makes the graph smarter because it remembers everything (RAG memory with pgvector).

Self-hosted. Your data never leaves your server. 9 LLM providers including fully local via Ollama. MIT licensed. Just launched today.

github.com/dsiemon2/OpenSentinel

I built this because the tools for this kind of investigation either cost thousands (Palantir Gotham, Maltego) or require stitching together 15 different scripts. This is one platform.

Happy to do a live demo if you want to see it in action.
