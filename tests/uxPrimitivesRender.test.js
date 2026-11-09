import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require_ = createRequire(import.meta.url);

async function renderEntry(name, source) {
  const { buildSync } = require_("esbuild");
  const baseDir = fileURLToPath(new URL("..", import.meta.url));
  const dir = fs.mkdtempSync(path.join(baseDir, ".orac-ssr-prim-"));
  const entry = path.join(dir, `${name}.jsx`);
  fs.writeFileSync(entry, source);
  const out = path.join(dir, `${name}.mjs`);
  try {
    buildSync({
      entryPoints: [entry],
      outfile: out,
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime"],
      absWorkingDir: baseDir,
      logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ PROD: false }) },
    });
    return await import(pathToFileURL(out).href);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("Button renders every variant, size, loading (aria-busy), disabled, default type=button, and link min-h classes", async () => {
  const mod = await renderEntry("buttonTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import Button from ${JSON.stringify(path.resolve("src/components/ui/Button.jsx"))};

    export const primary = renderToStaticMarkup(<Button variant="primary">Save</Button>);
    export const secondary = renderToStaticMarkup(<Button variant="secondary">Cancel</Button>);
    export const danger = renderToStaticMarkup(<Button variant="danger">Delete</Button>);
    export const ghost = renderToStaticMarkup(<Button variant="ghost">Clear</Button>);
    export const link = renderToStaticMarkup(<Button variant="link">Edit</Button>);
    export const sizeSm = renderToStaticMarkup(<Button size="sm">Small</Button>);
    export const sizeMd = renderToStaticMarkup(<Button size="md">Medium</Button>);
    export const loading = renderToStaticMarkup(<Button loading>Processing</Button>);
    export const disabled = renderToStaticMarkup(<Button disabled>Disabled</Button>);
  `);

  // Default type="button" and data-ux="button"
  assert.ok(mod.primary.includes('data-ux="button"'), "Button has data-ux=button");
  assert.ok(mod.primary.includes('type="button"'), "Button defaults type=button");
  assert.ok(mod.primary.includes('data-variant="primary"'), "Button variant primary");

  // Variants
  assert.ok(mod.secondary.includes('data-variant="secondary"'), "Button variant secondary");
  assert.ok(mod.danger.includes('data-variant="danger"'), "Button variant danger");
  assert.ok(mod.ghost.includes('data-variant="ghost"'), "Button variant ghost");
  assert.ok(mod.link.includes('data-variant="link"'), "Button variant link");

  // Link variant has both min-h classes
  assert.ok(mod.link.includes("min-h-[44px]"), "link variant has min-h-[44px]");
  assert.ok(mod.link.includes("min-[900px]:min-h-[32px]"), "link variant has min-[900px]:min-h-[32px]");

  // Sizes
  assert.ok(mod.sizeSm.includes('data-size="sm"'), "Button size sm");
  assert.ok(mod.sizeSm.includes("min-h-[40px]"), "Button size sm min-h-[40px]");
  assert.ok(mod.sizeMd.includes('data-size="md"'), "Button size md");
  assert.ok(mod.sizeMd.includes("min-h-[44px]"), "Button size md min-h-[44px]");

  // States
  assert.ok(mod.loading.includes('aria-busy="true"'), "loading shows aria-busy=true");
  assert.ok(mod.loading.includes("animate-spin"), "loading shows spinner");
  assert.ok(mod.disabled.includes("disabled"), "disabled button has disabled attribute");
});

test("Field renders label with data-ux, required marker, helper text, and error with role=alert", async () => {
  const mod = await renderEntry("fieldTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import Field from ${JSON.stringify(path.resolve("src/components/ui/Field.jsx"))};

    export const withAll = renderToStaticMarkup(
      <Field
        id="test-field"
        label="Test Label"
        required
        hint="Helpful guidance"
        error="Field has error"
      >
        <input id="test-field" />
      </Field>
    );
  `);

  assert.ok(mod.withAll.includes('data-ux="label"'), "label has data-ux=label");
  assert.ok(mod.withAll.includes('for="test-field"'), "label has htmlFor=test-field");
  assert.ok(mod.withAll.includes("(required)"), "required marker rendered");
  assert.ok(mod.withAll.includes("Helpful guidance"), "hint rendered");
  assert.ok(mod.withAll.includes('id="test-field-hint"'), "hint id wired");
  assert.ok(mod.withAll.includes('role="alert"'), "error has role=alert");
  assert.ok(mod.withAll.includes("Field has error"), "error text rendered");
  assert.ok(mod.withAll.includes('id="test-field-error"'), "error id wired");
});

test("Input, Select, and Textarea render data-ux=input, min-h classes, and aria-invalid when invalid", async () => {
  const mod = await renderEntry("controlsTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import Input from ${JSON.stringify(path.resolve("src/components/ui/Input.jsx"))};
    import Select from ${JSON.stringify(path.resolve("src/components/ui/Select.jsx"))};
    import Textarea from ${JSON.stringify(path.resolve("src/components/ui/Textarea.jsx"))};

    export const input = renderToStaticMarkup(<Input placeholder="Type" />);
    export const inputInvalid = renderToStaticMarkup(<Input aria-invalid="true" />);
    export const select = renderToStaticMarkup(
      <Select aria-invalid="true">
        <option value="1">One</option>
      </Select>
    );
    export const textarea = renderToStaticMarkup(<Textarea aria-invalid="true" rows={4} />);
  `);

  // Input
  assert.ok(mod.input.includes('data-ux="input"'), "Input has data-ux=input");
  assert.ok(mod.input.includes("min-h-[44px]"), "Input has min-h-[44px]");
  assert.ok(mod.input.includes("min-[900px]:min-h-[40px]"), "Input has min-[900px]:min-h-[40px]");
  assert.ok(mod.inputInvalid.includes('aria-invalid="true"'), "Input supports aria-invalid");

  // Select
  assert.ok(mod.select.includes('data-ux="input"'), "Select has data-ux=input");
  assert.ok(mod.select.includes("min-h-[44px]"), "Select has min-h-[44px]");
  assert.ok(mod.select.includes("min-[900px]:min-h-[40px]"), "Select has min-[900px]:min-h-[40px]");
  assert.ok(mod.select.includes('aria-invalid="true"'), "Select supports aria-invalid");
  assert.ok(mod.select.includes("<option"), "Select renders options");

  // Textarea
  assert.ok(mod.textarea.includes('data-ux="input"'), "Textarea has data-ux=input");
  assert.ok(mod.textarea.includes("min-h-[44px]"), "Textarea has min-h-[44px]");
  assert.ok(mod.textarea.includes("min-[900px]:min-h-[40px]"), "Textarea has min-[900px]:min-h-[40px]");
  assert.ok(mod.textarea.includes('aria-invalid="true"'), "Textarea supports aria-invalid");
  assert.ok(mod.textarea.includes('rows="4"'), "Textarea forwards rows");
});

test("Panel renders data-ux=panel and optional header slot", async () => {
  const mod = await renderEntry("panelTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import Panel from ${JSON.stringify(path.resolve("src/components/ui/Panel.jsx"))};

    export const withHeader = renderToStaticMarkup(
      <Panel header={<span>Header Title</span>}>
        <p>Panel Body</p>
      </Panel>
    );
    export const withoutHeader = renderToStaticMarkup(
      <Panel>
        <p>Solo Body</p>
      </Panel>
    );
  `);

  assert.ok(mod.withHeader.includes('data-ux="panel"'), "Panel has data-ux=panel");
  assert.ok(mod.withHeader.includes("Header Title"), "Panel renders header");
  assert.ok(mod.withHeader.includes("Panel Body"), "Panel renders body");
  assert.ok(!mod.withoutHeader.includes("Header Title"), "Solo Panel has no header");
  assert.ok(mod.withoutHeader.includes("Solo Body"), "Solo Panel renders body");
});

test("PageTitle renders h1, SectionTitle renders h2, and SubTitle renders h3", async () => {
  const mod = await renderEntry("titlesTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import PageTitle from ${JSON.stringify(path.resolve("src/components/ui/PageTitle.jsx"))};
    import SectionTitle from ${JSON.stringify(path.resolve("src/components/ui/SectionTitle.jsx"))};
    import SubTitle from ${JSON.stringify(path.resolve("src/components/ui/SubTitle.jsx"))};

    export const page = renderToStaticMarkup(<PageTitle>My Page</PageTitle>);
    export const section = renderToStaticMarkup(<SectionTitle>My Section</SectionTitle>);
    export const sub = renderToStaticMarkup(<SubTitle>My Sub</SubTitle>);
  `);

  assert.ok(mod.page.startsWith("<h1"), "PageTitle renders h1");
  assert.ok(mod.page.includes('data-ux="page-title"'), "PageTitle has data-ux=page-title");
  assert.ok(mod.page.includes("text-ux-title"), "PageTitle has text-ux-title");

  assert.ok(mod.section.startsWith("<h2"), "SectionTitle renders h2");
  assert.ok(mod.section.includes('data-ux="section-title"'), "SectionTitle has data-ux=section-title");
  assert.ok(mod.section.includes("text-ux-section"), "SectionTitle has text-ux-section");

  assert.ok(mod.sub.startsWith("<h3"), "SubTitle renders h3");
  assert.ok(mod.sub.includes('data-ux="sub-title"'), "SubTitle has data-ux=sub-title");
  assert.ok(mod.sub.includes("text-ux-sub"), "SubTitle has text-ux-sub");
});

test("Notice renders all four variants with the right role and icon", async () => {
  const mod = await renderEntry("noticeTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import Notice from ${JSON.stringify(path.resolve("src/components/ui/Notice.jsx"))};

    export const err = renderToStaticMarkup(<Notice variant="error">Critical alert</Notice>);
    export const warn = renderToStaticMarkup(<Notice variant="warning">Take care</Notice>);
    export const inf = renderToStaticMarkup(<Notice variant="info">FYI</Notice>);
    export const succ = renderToStaticMarkup(<Notice variant="success">All done</Notice>);
  `);

  assert.ok(mod.err.includes('role="alert"'), "error variant has role=alert");
  assert.ok(mod.err.includes('data-variant="error"'), "error variant has data-variant=error");

  assert.ok(mod.warn.includes('role="status"'), "warning variant has role=status");
  assert.ok(mod.warn.includes('data-variant="warning"'), "warning variant has data-variant=warning");

  assert.ok(mod.inf.includes('role="status"'), "info variant has role=status");
  assert.ok(mod.inf.includes('data-variant="info"'), "info variant has data-variant=info");

  assert.ok(mod.succ.includes('role="status"'), "success variant has role=status");
  assert.ok(mod.succ.includes('data-variant="success"'), "success variant has data-variant=success");
});

test("Badge and CountBadge render data-ux=badge with valid classes", async () => {
  const mod = await renderEntry("badgeTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import Badge, { CountBadge } from ${JSON.stringify(path.resolve("src/components/ui/Badge.jsx"))};

    export const badge = renderToStaticMarkup(<Badge tone="success">Active</Badge>);
    export const count = renderToStaticMarkup(<CountBadge count={7} />);
  `);

  assert.ok(mod.badge.includes('data-ux="badge"'), "Badge has data-ux=badge");
  assert.ok(mod.badge.includes("text-ux-secondary"), "Badge has text-ux-secondary");
  assert.ok(mod.badge.includes("border-orac-success-border"), "Badge has tone border");
  assert.ok(mod.badge.includes("h-1.5 w-1.5 rounded-full bg-current"), "Badge renders 6px dot");
  assert.ok(mod.badge.includes("rounded-full"), "Badge is rounded-full");

  assert.ok(mod.count.includes('data-ux="badge"'), "CountBadge has data-ux=badge");
  assert.ok(mod.count.includes("bg-orac-danger-text"), "CountBadge has bg-orac-danger-text");
  assert.ok(mod.count.includes("text-orac-canvas"), "CountBadge has text-orac-canvas");
  assert.ok(mod.count.includes(">7</span>"), "CountBadge renders count");
});

test("BrandMark renders at 40, 48, and 80 with alt, width, and height attributes", async () => {
  const mod = await renderEntry("brandMarkTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import BrandMark from ${JSON.stringify(path.resolve("src/components/ui/BrandMark.jsx"))};

    export const size40 = renderToStaticMarkup(<BrandMark size={40} alt="Orac Logo" />);
    export const size48 = renderToStaticMarkup(<BrandMark size={48} alt="Orac Medium" />);
    export const size80 = renderToStaticMarkup(<BrandMark size={80} alt="Orac Large" />);
  `);

  // Size 40
  assert.ok(mod.size40.includes('data-ux="brandmark"'), "BrandMark 40 has data-ux");
  assert.ok(mod.size40.includes('width="40"'), "BrandMark 40 width=40");
  assert.ok(mod.size40.includes('height="40"'), "BrandMark 40 height=40");
  assert.ok(mod.size40.includes('alt="Orac Logo"'), "BrandMark 40 alt set");

  // Size 48
  assert.ok(mod.size48.includes('width="48"'), "BrandMark 48 width=48");
  assert.ok(mod.size48.includes('height="48"'), "BrandMark 48 height=48");
  assert.ok(mod.size48.includes('alt="Orac Medium"'), "BrandMark 48 alt set");

  // Size 80
  assert.ok(mod.size80.includes('width="80"'), "BrandMark 80 width=80");
  assert.ok(mod.size80.includes('height="80"'), "BrandMark 80 height=80");
  assert.ok(mod.size80.includes('alt="Orac Large"'), "BrandMark 80 alt set");
});
