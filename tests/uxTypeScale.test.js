import test from "node:test";
import assert from "node:assert/strict";
import config from "../tailwind.config.js";

const expectedScale = {
  "ux-title": ["1.5rem", { lineHeight: "1.3", fontWeight: "700" }],
  "ux-section": ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
  "ux-sub": ["1rem", { lineHeight: "1.5", fontWeight: "600" }],
  "ux-label": ["1rem", { lineHeight: "1.5", fontWeight: "600" }],
  "ux-body": ["1rem", { lineHeight: "1.5", fontWeight: "400" }],
  "ux-secondary": ["0.875rem", { lineHeight: "1.45", fontWeight: "400" }],
  "ux-caption": ["0.75rem", { lineHeight: "1.4", fontWeight: "500" }],
  "ux-stat": ["1.75rem", { lineHeight: "1.2", fontWeight: "400" }]
};

test("type scale: tailwind.config.js defines each of the 8 semantic fontSize keys with exact size, lineHeight and fontWeight", () => {
  const fontSize = config.theme?.extend?.fontSize;
  assert.ok(fontSize, "theme.extend.fontSize must exist in tailwind.config.js");
  for (const [key, expected] of Object.entries(expectedScale)) {
    assert.deepEqual(fontSize[key], expected, `fontSize['${key}'] matches expected`);
  }
});

test("type scale: ladder descends properly: title 24 > section 18 > sub 16 = label 16 > secondary 14 > caption 12", () => {
  const toPx = (rem) => parseFloat(rem) * 16;
  const fontSize = config.theme.extend.fontSize;
  const title = toPx(fontSize["ux-title"][0]);
  const section = toPx(fontSize["ux-section"][0]);
  const sub = toPx(fontSize["ux-sub"][0]);
  const label = toPx(fontSize["ux-label"][0]);
  const secondary = toPx(fontSize["ux-secondary"][0]);
  const caption = toPx(fontSize["ux-caption"][0]);

  assert.equal(title, 24);
  assert.equal(section, 18);
  assert.equal(sub, 16);
  assert.equal(label, 16);
  assert.equal(secondary, 14);
  assert.equal(caption, 12);
  assert.ok(title > section, "title > section");
  assert.ok(section > sub, "section > sub");
  assert.equal(sub, label, "sub === label");
  assert.ok(label > secondary, "label > secondary");
  assert.ok(secondary > caption, "secondary > caption");
});
