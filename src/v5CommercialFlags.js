// Display-only V5 flag. The server's ORAC_V5_COMMERCIAL_WORKFLOW remains the
// authoritative control; this only prevents unfinished controls appearing.
const env = (name) => (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[name] !== undefined
  ? import.meta.env[name]
  : (typeof process !== "undefined" ? process.env?.[name] : undefined));

export const v5CommercialEnabled = () => env("VITE_ORAC_V5_COMMERCIAL_WORKFLOW") === "enabled";
// A separate client display gate mirrors the server writer gate. It never
// authorizes a request: the backend checks both server flags and the role.
export const v5InvoiceWriterEnabled = () => v5CommercialEnabled() && env("VITE_ORAC_V5_INVOICE_WRITER") === "enabled";
