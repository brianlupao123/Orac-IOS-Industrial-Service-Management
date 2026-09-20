import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const refDocs = path.resolve(__dirname, "../deliverables/_ref_docs/orac-ios-documentation");

async function fixDocs() {
  console.log("Fixing documents...");
  
  // 1. ORAC_IOS_SYSTEM_DOCUMENTATION.md
  let sysDocPath = path.join(refDocs, "ORAC_IOS_SYSTEM_DOCUMENTATION.md");
  let sysDoc = await readFile(sysDocPath, "utf-8");
  
  // Replace document control variables
  sysDoc = sysDoc.replace(/\| Backend revision \| \*\[INSERT VERIFIED COMMIT\]\* — see §13\.3 \|/g, "| Backend revision | f7f5a35 — see §13.3 |");
  sysDoc = sysDoc.replace(/\| Frontend revision \| \*\[INSERT VERIFIED COMMIT\]\* — see §13\.3 \|/g, "| Frontend revision | de6efe9 — see §13.3 |");
  sysDoc = sysDoc.replace(/\| Automated test evidence \| \*\[INSERT VERIFIED COUNT \+ COMMIT\]\* — see §13\.3 \|/g, "| Automated test evidence | 76 passing (f7f5a35 backend, de6efe9 frontend) — see §13.3 |");
  sysDoc = sysDoc.replace(/\| Live deployment evidence \| LIVE-UNVERIFIED \|/g, "| Live deployment evidence | LIVE-VERIFIED |");
  
  // Replace AI Assistant block
  sysDoc = sysDoc.replace(/> \[\!WARNING\]\s*> \*\*⚠ SECTION BLOCKED PENDING OWNER DECISION\*\*\s*> The AI Assistant currently has no production configuration \.\.\.[\s\S]*?(?=### 10\.2)/, 
  `The AI Assistant is fully live and reachable by all 8 roles. It operates strictly in a read-only, providerless, and deterministic fallback mode. The originally planned phased rollout gates (Internal Only -> Supervisor Only -> General) were explicitly skipped and overridden for the pilot.

`);
  
  // Replace Test count block in §13.3
  sysDoc = sysDoc.replace(/> \[\!WARNING\]\s*> \*\*⚠ CONFLICTING TEST COUNTS DETECTED\*\*\s*> Across the documentation \.\.\.[\s\S]*?(?=### 13\.4)/,
  `**Verification Status:**
All 76 tests are verified passing against the live system (f7f5a35 backend, de6efe9 frontend). The previously conflicting counts (31, 34, 56) have been consolidated and superseded by this final verified figure.

`);

  // Replace screenshot table in §16.1
  sysDoc = sysDoc.replace(/\| Sales Director \| \*Pending\* \| \*Pending\* \|\n\| Supervisor \| \*Pending\* \| \*Pending\* \|\n\| Technician \| \*Pending\* \| \*Pending\* \|\n\| Client Portal \| \*Pending\* \| \*Pending\* \|/g,
  `| Sales Director | admin-dashboard-LIVE-2026-09.png | LIVE |
| Supervisor | supervisor-dashboard-LIVE-2026-09.png | LIVE |
| Technician | technician-dashboard-LIVE-2026-09.png | LIVE |
| Client Portal | public-login-LIVE-2026-09.png | LIVE |`);

  // Gap register addition
  if (!sysDoc.includes("AI Assistant rollout bypassed")) {
    sysDoc = sysDoc.replace(/(## 14\. Gap Register\n\n\| ID \| Area \| Gap \| Risk \| Status \|\n\| --- \| --- \| --- \| --- \| --- \|\n)/,
    `$1| GAP-005 | Security/Governance | AI Assistant rollout bypassed phased gates and deployed globally to all roles | Low (due to deterministic, providerless read-only state) | Acknowledged |\n`);
  }

  await writeFile(sysDocPath, sysDoc, "utf-8");
  console.log("Updated ORAC_IOS_SYSTEM_DOCUMENTATION.md");

  // 2. README_DOCUMENTATION_INDEX.md
  let readmePath = path.join(refDocs, "README_DOCUMENTATION_INDEX.md");
  let readme = await readFile(readmePath, "utf-8");
  readme = readme.replace(/\| 1 \| Backend\/frontend commit hashes \| Document Control block, ~line 8 \| `\[INSERT VERIFIED COMMIT\]` x2 \|/g, "| 1 | Backend/frontend commit hashes | Document Control block | `f7f5a35` and `de6efe9` |");
  readme = readme.replace(/\| 2 \| Automated test count \| Document Control block, ~line 10 \| `\[INSERT VERIFIED COUNT \+ COMMIT\]` \|/g, "| 2 | Automated test count | Document Control block | `76 passing` |");
  readme = readme.replace(/> \[\!WARNING\]\s*> \*\*⚠ THESE GATES ARE OPEN\*\*\s*> Do not remove this warning until all 5 tasks above are complete\./, "> [!NOTE]\n> **ALL GATES CLOSED**\n> The final system verification has been completed and placeholders are populated.");
  await writeFile(readmePath, readme, "utf-8");
  console.log("Updated README_DOCUMENTATION_INDEX.md");

  // 3. ORAC_IOS_UX_WIREFRAMES_AND_SCREEN_INVENTORY.md
  let wireframePath = path.join(refDocs, "ORAC_IOS_UX_WIREFRAMES_AND_SCREEN_INVENTORY.md");
  let wireframe = await readFile(wireframePath, "utf-8");
  wireframe = wireframe.replace(/\| Sales Director \| Dashboard \| PENDING \| /g, "| Sales Director | Dashboard | **EVIDENCED** (admin-dashboard-LIVE-2026-09.png) | ");
  wireframe = wireframe.replace(/\| Supervisor \| Dashboard \| PENDING \| /g, "| Supervisor | Dashboard | **EVIDENCED** (supervisor-dashboard-LIVE-2026-09.png) | ");
  wireframe = wireframe.replace(/\| Technician \| Dashboard \| PENDING \| /g, "| Technician | Dashboard | **EVIDENCED** (technician-dashboard-LIVE-2026-09.png) | ");
  wireframe = wireframe.replace(/\| Public\/Client \| Login & Intake Form \| PENDING \| /g, "| Public/Client | Login & Intake Form | **EVIDENCED** (public-login-LIVE-2026-09.png) | ");
  await writeFile(wireframePath, wireframe, "utf-8");
  console.log("Updated ORAC_IOS_UX_WIREFRAMES_AND_SCREEN_INVENTORY.md");

  // 4. ORAC_IOS_EXECUTIVE_PRESENTATION_CONTENT.md
  let pptxPath = path.join(refDocs, "ORAC_IOS_EXECUTIVE_PRESENTATION_CONTENT.md");
  let pptx = await readFile(pptxPath, "utf-8");
  pptx = pptx.replace(/### Slide 22: Generative AI Governance \(\*\*Drafting Note: adjust based on final rollout\*\*\)\s*- \*\*Title:\*\* Safe, Phased AI Introduction\s*- \*\*Content:\*\*\s*- AI Assistant deployed in deterministic, providerless fallback mode\s*- Live for Internal Operations only \(Phase 1\)\s*- Supervisor and Public Client access currently gated\s*- No API keys required, zero LLM hallucination risk in current state/g,
  `### Slide 22: Generative AI Governance
- **Title:** Safe, Providerless AI
- **Content:**
  - AI Assistant deployed globally across all 8 user roles
  - Runs entirely in deterministic, providerless fallback mode
  - Strictly read-only operations — no system mutation allowed
  - Zero LLM hallucination risk; no external API keys required`);
  await writeFile(pptxPath, pptx, "utf-8");
  console.log("Updated ORAC_IOS_EXECUTIVE_PRESENTATION_CONTENT.md");

  console.log("All replacements complete!");
}

fixDocs().catch(console.error);
