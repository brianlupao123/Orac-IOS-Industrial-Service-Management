import test from "node:test";
import assert from "node:assert/strict";
import {
  SERVICE_REQUEST_STATUSES, buildServiceRequestPayload, canConvertToLead, clientStatusLabel,
  isRealCalendarDate, statusLabel, triageActionsFor, urgencyLabel, validateServiceRequestForm
} from "../src/serviceRequestModel.js";

const FORGED = {
  id: "sr_x", client_id: "c_other", clientId: "c_other", created_by_user_id: "u_admin", status: "Accepted",
  triaged_by_user_id: "u_sales", triaged_at: "2020-01-01", triage_note: "pre-approved", converted_lead_id: "lead_1",
  converted_by_user_id: "u_ops", converted_at: "2020-01-01", history: [{ status: "Accepted" }], lead_id: "lead_1"
};

test("the payload builder copies only whitelisted fields and never identity, tenant or lifecycle fields", () => {
  const payload = buildServiceRequestPayload({
    title: "  Idler check  ", service_need: "  Replace rollers  ", urgency: "urgent_downtime", requested_date: "2026-10-05",
    mine_site_id: " ms_1 ", equipment_tag_id: "eq_1", ...FORGED
  });
  assert.deepEqual(payload, {
    title: "Idler check", service_need: "Replace rollers", urgency: "urgent_downtime",
    mine_site_id: "ms_1", equipment_tag_id: "eq_1", requested_date: "2026-10-05"
  });
  for (const key of Object.keys(FORGED)) assert.equal(key in payload, false, `${key} must not be sent`);
});

test("optional fields are omitted when empty and urgency falls back to standard", () => {
  assert.deepEqual(buildServiceRequestPayload({ title: "T", service_need: "N", urgency: "bogus", requested_date: "", mine_site_id: "  " }), { title: "T", service_need: "N", urgency: "standard" });
  assert.deepEqual(buildServiceRequestPayload(), { title: "", service_need: "", urgency: "standard" });
});

test("form validation is a convenience check with clear messages", () => {
  assert.equal(validateServiceRequestForm({ title: "T", service_need: "N", urgency: "standard", requested_date: "" }), "");
  assert.match(validateServiceRequestForm({ title: " ", service_need: "N" }), /title/i);
  assert.match(validateServiceRequestForm({ title: "T", service_need: " " }), /describe/i);
  assert.match(validateServiceRequestForm({ title: "x".repeat(161), service_need: "N" }), /160/);
  assert.match(validateServiceRequestForm({ title: "T", service_need: "x".repeat(2001) }), /2000/);
  assert.match(validateServiceRequestForm({ title: "T", service_need: "N", urgency: "whenever" }), /urgency/i);
  assert.match(validateServiceRequestForm({ title: "T", service_need: "N", requested_date: "2026-02-30" }), /date/i);
  assert.equal(isRealCalendarDate("2026-02-28"), true);
  assert.equal(isRealCalendarDate("2028-02-29"), true);
  assert.equal(isRealCalendarDate("2026-02-29"), false);
  assert.equal(isRealCalendarDate("05/10/2026"), false);
});

test("triage buttons mirror the server transition table and conversion is only offered when Accepted", () => {
  const offered = (status) => triageActionsFor(status).map((action) => action.decision);
  assert.deepEqual(offered("Submitted"), ["acknowledge", "decline"]);
  assert.deepEqual(offered("Acknowledged"), ["accept", "decline"]);
  for (const status of ["Accepted", "Declined", "Converted_To_Lead", "Unknown", undefined]) assert.deepEqual(offered(status), []);
  assert.deepEqual(SERVICE_REQUEST_STATUSES.filter(canConvertToLead), ["Accepted"]);
  assert.equal(canConvertToLead("Declined"), false);
  assert.equal(canConvertToLead("Converted_To_Lead"), false);
});

test("labels are defined for every status and the client never sees internal lead wording", () => {
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.ok(statusLabel(status) && statusLabel(status) !== status.toUpperCase());
    assert.ok(clientStatusLabel(status));
  }
  assert.equal(clientStatusLabel("Converted_To_Lead").toLowerCase().includes("lead"), false);
  assert.equal(urgencyLabel("planned_shutdown"), "Planned shutdown");
  assert.equal(urgencyLabel(undefined), "—");
});
