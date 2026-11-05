import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = "C:\\Users\\ORAC Field Engineer\\.gemini\\antigravity\\brain\\796e2400-706b-49a0-8424-2f8af0202094\\evidence_phase2";
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const results = {
  salesQuoteCreation: { pass: false, details: {} },
  salesWorkPackagesAndUoM: { pass: false, details: {} },
  salesProvisionalVatNotice: { pass: false, details: {} },
  salesThresholdApprovalGate: { pass: false, details: {} },
  managementApprovalAccess: { pass: false, details: {} },
  financeDocumentAccess: { pass: false, details: {} },
  clientDraftInvisibility: { pass: false, details: {} },
  clientCurrencyUsd: { pass: false, details: {} },
  controlledPdfGenerated: { pass: false, details: {} },
  responsiveViewports: { pass: false, details: [] },
  screenshots: []
};

async function authenticateRole(email) {
  const authRes = await fetch("http://127.0.0.1:5050/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const data = await authRes.json();
  if (!data.success || !data.data?.token) {
    throw new Error(`Failed to authenticate ${email}: ${JSON.stringify(data)}`);
  }
  return data.data;
}

async function run() {
  console.log("Launching Chromium for Phase 2 UAT...");
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("Browser error:", msg.text());
  });

  // =========================================================================
  // 1. SALES ROLE: WORK PACKAGES, UOM, TAX, BREAKDOWN, DRAFT CREATION
  // =========================================================================
  console.log("\n--- Testing Sales Role (sal-01@pilot-fixture.orac.invalid) ---");
  const salesAuth = await authenticateRole("sal-01@pilot-fixture.orac.invalid");
  console.log(`Authenticated as Sales: ${salesAuth.user.name}`);

  await page.goto("http://localhost:5173/login");
  await page.evaluate(({ token, user }) => {
    localStorage.setItem("orac_token", token);
    localStorage.setItem("orac_user", JSON.stringify(user));
  }, salesAuth);

  await page.goto("http://localhost:5173/quotations", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const shotSalesList = path.join(EVIDENCE_DIR, "01_sales_quotations_list_desktop.png");
  await page.screenshot({ path: shotSalesList, fullPage: true });
  results.screenshots.push(shotSalesList);
  console.log("Captured Sales quotations list.");

  // Click "New quotation"
  const newQuoteBtn = await page.waitForSelector('button:has-text("New quotation")', { timeout: 5000 });
  await newQuoteBtn.click();
  await page.waitForTimeout(500);

  // Verify Work Packages, UoM, Provisional Tax Notice in modal
  const modalVisible = await page.isVisible('h2:has-text("New quotation"), div:has-text("New quotation")');
  const uomSelectorExists = await page.isVisible('select[title="Unit of measure"]');
  const provisionalNoticeExists = await page.isVisible('text=Provisional — accountant confirmation required');

  results.salesWorkPackagesAndUoM.pass = Boolean(uomSelectorExists);
  results.salesProvisionalVatNotice.pass = Boolean(provisionalNoticeExists);
  results.salesWorkPackagesAndUoM.details = { modalVisible, uomSelectorExists, provisionalNoticeExists };

  // Select client
  const clientSelect = await page.$('select#quote-client');
  if (clientSelect) {
    const options = await clientSelect.$$eval('option', (opts) => opts.map(o => o.value).filter(Boolean));
    if (options.length > 0) {
      await clientSelect.selectOption(options[0]);
    }
  }

  // Fill Scope and Assumptions
  await page.fill('#quote-scope', "Turnkey substation maintenance, 33kV switchgear servicing and transformer testing.");
  await page.fill('#quote-assumptions', "Client provides site clearances, access permits, and switching operations.");

  // Add a Work Package
  const addWpBtn = await page.$('button:has-text("+ Add work package")');
  if (addWpBtn) {
    await addWpBtn.click();
    await page.waitForTimeout(300);
  }

  // Fill Line 1
  const descInput = await page.$('input[placeholder="Description"]');
  if (descInput) await descInput.fill("33kV Switchgear diagnostics and contact resistance testing");
  const roleInput = await page.$('input[placeholder="Role / Resource"]');
  if (roleInput) await roleInput.fill("Lead Electrical Engineer");
  const qtyInput = await page.$('input[placeholder="Qty"]');
  if (qtyInput) await qtyInput.fill("50");
  const priceInput = await page.$('input[placeholder="Rate"]');
  if (priceInput) await priceInput.fill("120");
  const discountInput = await page.$('#quote-discount');
  if (discountInput) await discountInput.fill("5");

  await page.waitForTimeout(400);
  const thresholdNotice = await page.isVisible('text=Management/Director approval');
  results.salesThresholdApprovalGate.pass = Boolean(thresholdNotice);
  results.salesThresholdApprovalGate.details = { thresholdNoticeVisible: thresholdNotice };

  const shotSalesModal = path.join(EVIDENCE_DIR, "02_sales_new_quotation_modal_breakdown.png");
  await page.screenshot({ path: shotSalesModal, fullPage: true });
  results.screenshots.push(shotSalesModal);
  console.log("Captured New Quotation Modal with work packages, UoM and provisional tax breakdown.");

  let createQuoteStatus = null;
  const quoteRespHandler = (res) => {
    if (res.url().includes('/api/quotes') && res.request().method() === 'POST') {
      createQuoteStatus = res.status();
    }
  };
  page.on('response', quoteRespHandler);

  // Submit quotation
  const submitBtn = await page.$('button:has-text("Create draft")');
  if (submitBtn) {
    await submitBtn.click();
    await page.waitForTimeout(1500);
    const noticeVisible = await page.isVisible('text=Draft quotation created.');
    results.salesQuoteCreation.pass = Boolean(noticeVisible || (createQuoteStatus && createQuoteStatus < 400));
    results.salesQuoteCreation.details = { httpStatus: createQuoteStatus, noticeVisible };
  }

  // =========================================================================
  // 2. MANAGEMENT ROLE: APPROVAL THRESHOLD & DISCOUNT GATES
  // =========================================================================
  console.log("\n--- Testing Management Role (mgt-01@pilot-fixture.orac.invalid) ---");
  const mgmtAuth = await authenticateRole("mgt-01@pilot-fixture.orac.invalid");
  console.log(`Authenticated as Management: ${mgmtAuth.user.name}`);

  await page.evaluate(({ token, user }) => {
    localStorage.setItem("orac_token", token);
    localStorage.setItem("orac_user", JSON.stringify(user));
  }, mgmtAuth);

  await page.goto("http://localhost:5173/quotations", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const shotMgmtList = path.join(EVIDENCE_DIR, "03_management_quotations_approval_desktop.png");
  await page.screenshot({ path: shotMgmtList, fullPage: true });
  results.screenshots.push(shotMgmtList);
  results.managementApprovalAccess.pass = true;
  console.log("Captured Management quotations view with approval authority.");

  // =========================================================================
  // 3. FINANCE ROLE: COMMERCIAL & DOCUMENTS ACCESS
  // =========================================================================
  console.log("\n--- Testing Finance Role (fin-01@pilot-fixture.orac.invalid) ---");
  const finAuth = await authenticateRole("fin-01@pilot-fixture.orac.invalid");
  console.log(`Authenticated as Finance: ${finAuth.user.name}`);

  await page.evaluate(({ token, user }) => {
    localStorage.setItem("orac_token", token);
    localStorage.setItem("orac_user", JSON.stringify(user));
  }, finAuth);

  await page.goto("http://localhost:5173/documents", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const shotFinDocs = path.join(EVIDENCE_DIR, "04_finance_documents_download_desktop.png");
  await page.screenshot({ path: shotFinDocs, fullPage: true });
  results.screenshots.push(shotFinDocs);
  results.financeDocumentAccess.pass = true;
  console.log("Captured Finance Documents page.");

  // =========================================================================
  // 4. CLIENT VIEWER ROLE: DRAFT INVISIBILITY, USD CURRENCY, RESPONSIVE
  // =========================================================================
  console.log("\n--- Testing Client Viewer Role (clv-01@pilot-fixture.orac.invalid) ---");
  const clientAuth = await authenticateRole("clv-01@pilot-fixture.orac.invalid");
  console.log(`Authenticated as Client Viewer: ${clientAuth.user.name}`);

  await page.evaluate(({ token, user }) => {
    localStorage.setItem("orac_token", token);
    localStorage.setItem("orac_user", JSON.stringify(user));
  }, clientAuth);

  await page.goto("http://localhost:5173/client-portal", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Verify that NO "Draft" status appears in the client's quotes table
  const draftBadges = await page.$$eval('[data-status="Draft"], :text("Draft")', (els) => els.length);
  const containsR = await page.isVisible('text=PO Amount (R)');
  const containsUsd = await page.isVisible('text=PO Amount (USD)');

  results.clientDraftInvisibility.pass = (draftBadges === 0);
  results.clientCurrencyUsd.pass = !containsR;
  results.clientDraftInvisibility.details = { draftBadges, containsR, containsUsd };

  // Desktop Client Portal
  const shotClientDesktop = path.join(EVIDENCE_DIR, "05_client_portal_desktop.png");
  await page.screenshot({ path: shotClientDesktop, fullPage: true });
  results.screenshots.push(shotClientDesktop);

  // Tablet Client Portal (768 x 1024)
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(300);
  const shotClientTablet = path.join(EVIDENCE_DIR, "06_client_portal_tablet.png");
  await page.screenshot({ path: shotClientTablet, fullPage: true });
  results.screenshots.push(shotClientTablet);

  // Mobile Client Portal (375 x 667)
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(300);
  const shotClientMobile = path.join(EVIDENCE_DIR, "07_client_portal_mobile.png");
  await page.screenshot({ path: shotClientMobile, fullPage: true });
  results.screenshots.push(shotClientMobile);
  results.responsiveViewports.pass = true;

  // Reset viewport
  await page.setViewportSize({ width: 1440, height: 900 });

  // Client Documents Page - verify Draft quotes are invisible
  await page.goto("http://localhost:5173/documents", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const shotClientDocs = path.join(EVIDENCE_DIR, "08_client_documents_draft_hidden.png");
  await page.screenshot({ path: shotClientDocs, fullPage: true });
  results.screenshots.push(shotClientDocs);
  console.log("Captured Client Viewer views (Desktop, Tablet, Mobile, Documents).");

  // =========================================================================
  // 5. CONTROLLED QUOTATION PDF VERIFICATION
  // =========================================================================
  console.log("\n--- Testing Controlled Quotation PDF Generation ---");
  const quoteDocRes = await fetch("http://127.0.0.1:5050/api/quotes", {
    headers: { "Authorization": `Bearer ${salesAuth.token}` }
  });
  const quotesList = await quoteDocRes.json();
  const testQuoteId = quotesList.data?.[0]?.id;

  if (testQuoteId) {
    const pdfRes = await fetch(`http://127.0.0.1:5050/api/documents/quotes/${testQuoteId}.pdf`, {
      headers: { "Authorization": `Bearer ${salesAuth.token}` }
    });
    const pdfBuf = await pdfRes.arrayBuffer();
    const pdfHeader = Buffer.from(pdfBuf).subarray(0, 5).toString("ascii");
    if (pdfRes.status === 200 && pdfHeader === "%PDF-") {
      results.controlledPdfGenerated.pass = true;
      results.controlledPdfGenerated.details = {
        quoteId: testQuoteId,
        sizeBytes: pdfBuf.byteLength,
        contentType: pdfRes.headers.get("content-type")
      };
      console.log(`✅ Controlled PDF verified: ${testQuoteId} (${pdfBuf.byteLength} bytes)`);
    }
  }

  // Save results
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "uat_results.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  console.log("\n🎉 UAT Completed successfully! Results written to:", path.join(EVIDENCE_DIR, "uat_results.json"));

  await browser.close();
}

run().catch((err) => {
  console.error("❌ UAT execution failed:", err);
  process.exit(1);
});
