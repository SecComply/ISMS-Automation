# SecComply ISMS Platform v6

## What's New in v6: Smart Gap Assessment Engine

### 🧠 Conditional Logic Engine
- 102 pre-loaded ISO 27001:2022 questions across 11 security domains
- **DISCOVERY** questions map client tech stack first
- **DRILL-DOWN** questions appear dynamically based on answers (e.g., AWS-specific questions only show if AWS is selected)
- **GAP** questions are universal, always shown
- No Excel upload needed — questions are built-in with smart flow

### 📊 11 Security Domains
1. ☁️ Cloud Infrastructure & Services (18 questions)
2. 🌐 Network Infrastructure (10 questions)
3. 💻 Endpoint & Device Security (12 questions)
4. 🔐 Identity & Access Management (10 questions)
5. 🛡️ Data Protection & Encryption (9 questions)
6. ⚙️ Application Security & DevSecOps (10 questions)
7. 📊 Logging, Monitoring & SOC (8 questions)
8. 📧 Email & Collaboration Security (6 questions)
9. 🔄 Backup, DR & Business Continuity (7 questions)
10. 🔍 Vulnerability & Patch Management (6 questions)
11. 🤝 Third-Party & Supply Chain Risk (6 questions)

### 🎯 Scoring System
- Yes + Full Evidence = 100%
- Yes + Partial Evidence = 70%
- Yes + No Evidence = 60%
- Partial + Evidence = 50%
- Partial + No Evidence = 30%
- No = 0%
- N/A = Excluded
- MAJOR severity weighted 2x vs MODERATE

### 📋 Evidence Collection
- Per-question evidence checklist (parsed from ISO requirements)
- File upload to Supabase Storage
- Google Drive / OneDrive link support
- Evidence completion tracking per question and per domain

### 📈 Gap Assessment Dashboard
- Overall compliance score with weighted calculation
- Domain-wise compliance bars
- Response distribution (Yes/No/Partial/N/A) pie chart
- Gap severity breakdown (MAJOR vs MODERATE)
- Export to Excel with full assessment data

## Setup
```bash
npm install
npm run dev
```

## Supabase Configuration
Update `SUPA_URL` and `SUPA_KEY` in `src/App.jsx` with your Supabase project credentials.

## Modules (11 total)
Dashboard, SOA, **Gap Assessment** (v6), Risk Register, Asset Register, Policies, Evidence, Roles & RACI, VAPT, Training, Internal Audit
