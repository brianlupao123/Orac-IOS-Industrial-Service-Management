// Display-only TOTP enrollment flag. The server's ORAC_TOTP_ENROLLMENT_ENABLED
// remains the authoritative control; this controls visibility of the
// enrollment entry point in the UI.
const env = (name) => (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[name] !== undefined
  ? import.meta.env[name]
  : (typeof process !== "undefined" ? process.env?.[name] : undefined));

export const totpEnrollmentUiEnabled = () => env("VITE_ORAC_TOTP_ENROLLMENT_UI") === "enabled";
