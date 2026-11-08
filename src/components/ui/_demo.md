# ORAC-IOS UI Primitives Reference & Usage Demo

This document demonstrates the shared primitive components located in `src/components/ui/`.
All primitives set explicit semantic tokens, scale typography via `text-ux-*`, and set `data-ux` attributes.

---

## 1. Button

- **Location**: `src/components/ui/Button.jsx`
- **data-ux**: `"button"`
- **Props**:
  - `variant`: `"primary"` | `"secondary"` (default) | `"danger"` | `"ghost"` | `"link"`
  - `size`: `"md"` (default, `min-h-[44px]`) | `"sm"` (`min-h-[40px]`)
  - `type`: `"button"` (default) | `"submit"` | `"reset"`
  - `loading`: boolean (renders accessible spinner while keeping button dimensions, sets `aria-busy`)
  - `disabled`: boolean
  - `className`: string
  - Standard HTML button attributes forwarded
- **Usage Example**:
  ```jsx
  import Button from "@/components/ui/Button";

  // Primary action button
  <Button variant="primary" size="md" onClick={handleSave}>
    Save changes
  </Button>

  // Table row action link (min 44px on mobile, min 32px on >=900px)
  <Button variant="link" onClick={() => handleEdit(row.id)}>
    Edit
  </Button>
  ```

---

## 2. Field

- **Location**: `src/components/ui/Field.jsx`
- **data-ux**: `"label"` (on `<label>`)
- **Props**:
  - `id`: string (wires `htmlFor` and error/hint ARIA IDs)
  - `label`: string | ReactNode
  - `required`: boolean (renders `(required)` indicator)
  - `hint`: string | ReactNode (helper text with `text-ux-secondary`)
  - `error`: string | ReactNode (error message with `role="alert"` and warning icon)
  - `children`: ReactNode (form control)
  - `className`: string
- **Usage Example**:
  ```jsx
  import Field from "@/components/ui/Field";
  import Input from "@/components/ui/Input";

  <Field
    id="client-name"
    label="Client Name"
    required
    hint="Enter official registered company name"
    error={errors.clientName}
  >
    <Input
      id="client-name"
      value={clientName}
      onChange={(e) => setClientName(e.target.value)}
      aria-invalid={Boolean(errors.clientName)}
    />
  </Field>
  ```

---

## 3. Input

- **Location**: `src/components/ui/Input.jsx`
- **data-ux**: `"input"`
- **Heights**: `min-h-[44px]` (<900px) and `min-[900px]:min-h-[40px]` (>=900px)
- **Props**:
  - `type`: string (default `"text"`)
  - `className`: string
  - Standard HTML input attributes forwarded (supports `ref`)
- **Usage Example**:
  ```jsx
  import Input from "@/components/ui/Input";

  <Input
    type="email"
    placeholder="user@example.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
  ```

---

## 4. Select

- **Location**: `src/components/ui/Select.jsx`
- **data-ux**: `"input"`
- **Heights**: `min-h-[44px]` (<900px) and `min-[900px]:min-h-[40px]` (>=900px)
- **Props**:
  - `children`: ReactNode (`<option>` elements)
  - `className`: string
  - Standard HTML select attributes forwarded (supports `ref`)
- **Usage Example**:
  ```jsx
  import Select from "@/components/ui/Select";

  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
    <option value="active">Active</option>
    <option value="inactive">Inactive</option>
  </Select>
  ```

---

## 5. Textarea

- **Location**: `src/components/ui/Textarea.jsx`
- **data-ux**: `"input"`
- **Heights**: `min-h-[44px]` (<900px) and `min-[900px]:min-h-[40px]` (>=900px)
- **Props**:
  - `rows`: number (default `3`)
  - `className`: string
  - Standard HTML textarea attributes forwarded (supports `ref`)
- **Usage Example**:
  ```jsx
  import Textarea from "@/components/ui/Textarea";

  <Textarea
    rows={4}
    placeholder="Provide operational details..."
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
  />
  ```

---

## 6. Panel

- **Location**: `src/components/ui/Panel.jsx`
- **data-ux**: `"panel"`
- **Props**:
  - `header`: ReactNode (optional header slot with separator)
  - `children`: ReactNode
  - `className`: string
  - Standard HTML div attributes forwarded
- **Usage Example**:
  ```jsx
  import Panel from "@/components/ui/Panel";
  import SectionTitle from "@/components/ui/SectionTitle";

  <Panel header={<SectionTitle>Overview</SectionTitle>}>
    <p className="text-ux-body text-orac-text-primary">
      Operational queue details and active metrics.
    </p>
  </Panel>
  ```

---

## 7. PageTitle

- **Location**: `src/components/ui/PageTitle.jsx`
- **data-ux**: `"page-title"`
- **Element**: `<h1>`
- **Typography**: `text-ux-title` (24px, 700 weight, line-height 1.3)
- **Props**:
  - `children`: ReactNode
  - `className`: string
- **Usage Example**:
  ```jsx
  import PageTitle from "@/components/ui/PageTitle";

  <PageTitle>Inventory Register</PageTitle>
  ```

---

## 8. SectionTitle

- **Location**: `src/components/ui/SectionTitle.jsx`
- **data-ux**: `"section-title"`
- **Element**: `<h2>`
- **Typography**: `text-ux-section` (18px, 600 weight, line-height 1.4)
- **Props**:
  - `children`: ReactNode
  - `className`: string
- **Usage Example**:
  ```jsx
  import SectionTitle from "@/components/ui/SectionTitle";

  <SectionTitle>Stock Replenishment</SectionTitle>
  ```

---

## 9. SubTitle

- **Location**: `src/components/ui/SubTitle.jsx`
- **data-ux**: `"sub-title"`
- **Element**: `<h3>`
- **Typography**: `text-ux-sub` (16px, 600 weight, line-height 1.5)
- **Hierarchy Guarantee**: Never larger than `SectionTitle` (18px > 16px)
- **Props**:
  - `children`: ReactNode
  - `className`: string
- **Usage Example**:
  ```jsx
  import SubTitle from "@/components/ui/SubTitle";

  <SubTitle>Recent Dispatches</SubTitle>
  ```

---

## 10. Notice

- **Location**: `src/components/ui/Notice.jsx`
- **data-ux**: `"notice"`
- **Props**:
  - `variant`: `"info"` (default) | `"warning"` | `"error"` | `"success"`
  - `title`: string | ReactNode (optional header)
  - `children`: ReactNode
  - `className`: string
- **Accessibility**:
  - `role="alert"` for `"error"` variant
  - `role="status"` for `"warning"`, `"info"`, and `"success"` variants
  - Always pairs visual icon with text (never color alone)
- **Usage Example**:
  ```jsx
  import Notice from "@/components/ui/Notice";

  <Notice variant="warning" title="Stale Cache Warning">
    Offline changes have not yet synced with the server.
  </Notice>
  ```

---

## 11. Badge & CountBadge

- **Location**: `src/components/ui/Badge.jsx`
- **data-ux**: `"badge"`
- **Typography**: `text-ux-caption` (12px, 500 weight)
- **Props (Badge)**:
  - `tone`: `"neutral"` (default) | `"info"` | `"success"` | `"warning"` | `"danger"` | `"count"`
  - `variant`: `"count"` (alias for count tone)
  - `children`: ReactNode
- **Props (CountBadge)**:
  - `count`: number | string
  - `className`: string
- **Contrast**:
  - Uses `bg-orac-danger-text` with `text-orac-canvas`
  - In light theme (`#ffffff` on `#b91c1c`), contrast ratio is **6.47:1** (>= 4.5:1).
  - In dark theme (`#0b0f19` on `#ff9aa8`), contrast ratio is **9.52:1** (>= 4.5:1).
- **Usage Example**:
  ```jsx
  import Badge, { CountBadge } from "@/components/ui/Badge";

  // Status badge
  <Badge tone="success">Active</Badge>

  // Notification counter
  <CountBadge count={5} />
  ```

---

## 12. BrandMark

- **Location**: `src/components/ui/BrandMark.jsx`
- **data-ux**: `"brandmark"`
- **Props**:
  - `size`: `40` (default) | `48` | `80`
  - `alt`: string (default `"Orac Systems"`)
  - `className`: string
- **Attributes**: Always outputs explicit `width={size}` and `height={size}` on `<img>` inside a circular white container.
- **Usage Example**:
  ```jsx
  import BrandMark from "@/components/ui/BrandMark";

  <BrandMark size={40} alt="Orac Systems" />
  ```
