---
academy: "KOMBAT Fitness Academy"
branch: "Main Branch"
category: "fees"
audience: "junior"
status: "active"
source: "academy_verified_data"
version: "1.0"
---

# Main Branch — Junior Fees

- Monthly fee: ₹1,500
- One free demo/trial session provided initially

If the student joins after the demo:

- Registration + ID: ₹1,500
- JKD Uniform: ₹1,500
- Monthly fee: ₹1,500
- **First month total: ₹4,500** (₹1,500 + ₹1,500 + ₹1,500)
- From the second month: ₹1,500/month

Note for maintainers: these exact figures are also encoded as constants in
`src/services/businessQuery.service.ts` (`FEE_PROFILES.MAIN_JUNIOR`) so the
chatbot can do reliable arithmetic - if this fee ever changes, update both
this file and that constant. See `docs/KNOWLEDGE_BASE.md`.
