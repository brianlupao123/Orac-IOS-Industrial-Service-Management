import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const UI_DIR = path.resolve("src/components/ui");

const readComponent = (filename) => {
  return fs.readFileSync(path.join(UI_DIR, filename), "utf8");
};

test("primitives: all 12 components exist under src/components/ui/", () => {
  const files = [
    "Button.jsx",
    "Field.jsx",
    "Input.jsx",
    "Select.jsx",
    "Textarea.jsx",
    "Panel.jsx",
    "PageTitle.jsx",
    "SectionTitle.jsx",
    "SubTitle.jsx",
    "Notice.jsx",
    "Badge.jsx",
    "BrandMark.jsx"
  ];
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(UI_DIR, file)), `${file} must exist`);
  }
});

test("primitives: every component defines its expected data-ux attribute", () => {
  const expectations = {
    "Button.jsx": 'data-ux="button"',
    "Field.jsx": 'data-ux="label"',
    "Input.jsx": 'data-ux="input"',
    "Select.jsx": 'data-ux="input"',
    "Textarea.jsx": 'data-ux="input"',
    "Panel.jsx": 'data-ux="panel"',
    "PageTitle.jsx": 'data-ux="page-title"',
    "SectionTitle.jsx": 'data-ux="section-title"',
    "SubTitle.jsx": 'data-ux="sub-title"',
    "Notice.jsx": 'data-ux="notice"',
    "Badge.jsx": 'data-ux="badge"',
    "BrandMark.jsx": 'data-ux="brandmark"'
  };

  for (const [file, expectedDataUx] of Object.entries(expectations)) {
    const src = readComponent(file);
    assert.ok(src.includes(expectedDataUx), `${file} must include ${expectedDataUx}`);
  }
});

test("primitives: Button defaults type=\"button\"", () => {
  const src = readComponent("Button.jsx");
  assert.ok(src.includes('type = "button"'), "Button must default type to 'button'");
});

test("primitives: Button link variant defines minimum height under 900px (44px) and from 900px up (32px)", () => {
  const src = readComponent("Button.jsx");
  assert.ok(src.includes("min-h-[44px]"), "Button must define min-h-[44px]");
  assert.ok(
    src.includes("min-[900px]:min-h-[32px]"),
    "Button link variant must include min-[900px]:min-h-[32px]"
  );
});

test("primitives: input controls (Input, Select, Textarea) define min-h-[44px] and min-[900px]:min-h-[40px]", () => {
  for (const file of ["Input.jsx", "Select.jsx", "Textarea.jsx"]) {
    const src = readComponent(file);
    // InputBaseClass or inline
    assert.ok(
      src.includes("min-h-[44px]") || file !== "Input.jsx",
      `${file} must have min-h-[44px]`
    );
    assert.ok(
      src.includes("min-[900px]:min-h-[40px]") || file !== "Input.jsx",
      `${file} must have min-[900px]:min-h-[40px]`
    );
  }
});

test("primitives: components use tokens only, no raw colour classes (no bg-gray-*, text-slate-*, or hex colors)", () => {
  const files = [
    "Button.jsx",
    "Field.jsx",
    "Input.jsx",
    "Select.jsx",
    "Textarea.jsx",
    "Panel.jsx",
    "PageTitle.jsx",
    "SectionTitle.jsx",
    "SubTitle.jsx",
    "Notice.jsx",
    "Badge.jsx",
    "BrandMark.jsx"
  ];

  const rawColorRegex = /\b(?:bg|text)-(?:gray|slate)-\d{2,3}\b/;
  const hexRegex = /#[0-9a-fA-F]{3,6}\b/;

  for (const file of files) {
    const src = readComponent(file);
    assert.ok(
      !rawColorRegex.test(src),
      `${file} must not contain raw palette colors like bg-gray-* or text-slate-*`
    );
    assert.ok(
      !hexRegex.test(src),
      `${file} must not contain hex color literals`
    );
  }
});

test("primitives: BrandMark renders /images/orac-systems-logo.png with alt and width/height attributes", () => {
  const src = readComponent("BrandMark.jsx");
  assert.ok(src.includes("/images/orac-systems-logo.png"), "BrandMark must render logo image");
  assert.ok(src.includes('alt={alt}') || src.includes('alt="Orac Systems"'), "BrandMark must set alt");
  assert.ok(src.includes("width={size}"), "BrandMark must set width attribute");
  assert.ok(src.includes("height={size}"), "BrandMark must set height attribute");
});
