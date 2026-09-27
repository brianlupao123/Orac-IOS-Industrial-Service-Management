import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collections, contracts, maintenanceSchedules } from "../api/client.js";
import { Icon, ICONS } from "../components/icons.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import { ErrorBanner, PageEmptyState } from "../components/PageStates.jsx";
import {
  CONTRACT_CREATE_STATUSES,
  SCHEDULE_FREQUENCIES,
  asList,
  canManageContracts,
  canManageSchedules,
  formatMoney,
  isContractOpen,
  isOverdue,
  statusOptionsFor,
  todayIso,
  validateContractForm,
  validateScheduleForm
} from "../contractsModel.js";

const inputClass = "w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orac-blue/30 disabled:bg-gray-100";
const primaryButton = "rounded-lg bg-orac-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orac-blue/90 focus:outline-none focus:ring-2 focus:ring-orac-blue/40 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-orac-slate hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orac-blue/30 disabled:cursor-not-allowed disabled:opacity-60";

const STATUS_STYLES = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-emerald-100 text-emerald-800",
  Expired: "bg-amber-100 text-amber-800",
  Cancelled: "bg-red-100 text-red-800"
};

const EMPTY_CONTRACT = { client_id: "", title: "", start_date: "", end_date: "", total_value: "", status: "Draft" };
const EMPTY_SCHEDULE = { contract_id: "", equipment_tag_id: "", frequency: "Monthly", next_due_date: "", notes: "" };

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-orac-slate">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}

const fieldProps = (id, error, hint) => ({
  id,
  className: `${inputClass} ${error ? "border-red-400" : "border-gray-300"}`,
  "aria-invalid": error ? "true" : "false",
  "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined
});

function StatusPill({ status }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.Draft}`}>{status}</span>;
}

function ContractForm({ draft, clients, submitting, onChange, onSubmit, onCancel }) {
  const { mode, values, errors, serverError, original } = draft;
  const editing = mode === "edit";
  const statusChoices = editing ? statusOptionsFor(original.status) : CONTRACT_CREATE_STATUSES;
  const set = (key) => (event) => onChange({ ...values, [key]: event.target.value });

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="contract-form-title" className="space-y-4 border-b border-gray-200 bg-gray-50 p-4" data-evidence="contract-form">
      <h3 id="contract-form-title" className="text-base font-semibold text-orac-slate">
        {editing ? `Edit ${original.contract_number}` : "New contract"}
      </h3>
      {(serverError || errors.form) && (
        <div role="alert" data-evidence="contract-form-error"><ErrorBanner message={serverError || errors.form} /></div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contract-client_id" label="Client" error={errors.client_id} hint={editing ? "A contract cannot be moved to another client." : undefined}>
          {editing ? (
            <input type="text" {...fieldProps("contract-client_id", errors.client_id, true)} value={clients.find((client) => client.id === original.client_id)?.name || "Client unavailable"} readOnly disabled />
          ) : (
            <select {...fieldProps("contract-client_id", errors.client_id)} value={values.client_id} onChange={set("client_id")} disabled={submitting} autoFocus>
              <option value="">Select a client</option>
              {clients.filter((client) => client.is_active !== false).map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field id="contract-status" label="Status" error={errors.status} hint={editing ? "Expired and Cancelled contracts can no longer be edited." : "New contracts start as Draft or Active."}>
          <select {...fieldProps("contract-status", errors.status, true)} value={values.status} onChange={set("status")} disabled={submitting}>
            {statusChoices.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </Field>
      </div>
      <Field id="contract-title" label="Title" error={errors.title}>
        <input type="text" {...fieldProps("contract-title", errors.title)} value={values.title} onChange={set("title")} maxLength={160} disabled={submitting} autoFocus={editing} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="contract-start_date" label="Start date" error={errors.start_date}>
          <input type="date" {...fieldProps("contract-start_date", errors.start_date)} value={values.start_date} onChange={set("start_date")} disabled={submitting} />
        </Field>
        <Field id="contract-end_date" label="End date" error={errors.end_date}>
          <input type="date" {...fieldProps("contract-end_date", errors.end_date)} value={values.end_date} onChange={set("end_date")} disabled={submitting} />
        </Field>
        <Field id="contract-total_value" label="Total value (USD, optional)" error={errors.total_value}>
          <input type="number" inputMode="decimal" min="0" step="0.01" {...fieldProps("contract-total_value", errors.total_value)} value={values.total_value} onChange={set("total_value")} disabled={submitting} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButton} disabled={submitting}>{submitting ? "Saving contract" : "Save contract"}</button>
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>
    </form>
  );
}

function ScheduleForm({ draft, openContracts, contractById, tags, submitting, onChange, onSubmit, onCancel }) {
  const { mode, values, errors, serverError, original } = draft;
  const editing = mode === "edit";
  const contract = contractById.get(editing ? original.contract_id : values.contract_id) || null;
  const set = (key) => (event) => onChange({ ...values, [key]: event.target.value });

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="schedule-form-title" className="space-y-4 border-b border-gray-200 bg-gray-50 p-4" data-evidence="schedule-form">
      <h3 id="schedule-form-title" className="text-base font-semibold text-orac-slate">
        {editing ? "Edit maintenance schedule" : "New maintenance schedule"}
      </h3>
      {(serverError || errors.form) && (
        <div role="alert" data-evidence="schedule-form-error"><ErrorBanner message={serverError || errors.form} /></div>
      )}
      <Field id="schedule-contract_id" label="Contract" error={errors.contract_id}>
        {editing ? (
          <input type="text" {...fieldProps("schedule-contract_id", errors.contract_id)} value={contract ? `${contract.contract_number} ${contract.title}` : "Contract unavailable"} readOnly disabled />
        ) : (
          <select {...fieldProps("schedule-contract_id", errors.contract_id)} value={values.contract_id} onChange={set("contract_id")} disabled={submitting} autoFocus>
            <option value="">Select a contract</option>
            {openContracts.map((item) => (
              <option key={item.id} value={item.id}>{item.contract_number} {item.title}</option>
            ))}
          </select>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="schedule-frequency" label="Frequency" error={errors.frequency}>
          <select {...fieldProps("schedule-frequency", errors.frequency)} value={values.frequency} onChange={set("frequency")} disabled={submitting}>
            {SCHEDULE_FREQUENCIES.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}
          </select>
        </Field>
        <Field
          id="schedule-next_due_date"
          label="Next due date"
          error={errors.next_due_date}
          hint={contract ? `Must fall between ${contract.start_date} and ${contract.end_date}.` : "Choose a contract to see its dates."}
        >
          <input type="date" {...fieldProps("schedule-next_due_date", errors.next_due_date, true)} value={values.next_due_date} onChange={set("next_due_date")} disabled={submitting} />
        </Field>
      </div>
      <Field
        id="schedule-equipment_tag_id"
        label="Equipment tag (optional)"
        error={errors.equipment_tag_id}
        hint="Leave empty to cover the whole contract. Only equipment belonging to the contract's client is accepted."
      >
        <select {...fieldProps("schedule-equipment_tag_id", errors.equipment_tag_id, true)} value={values.equipment_tag_id} onChange={set("equipment_tag_id")} disabled={submitting}>
          <option value="">No specific equipment</option>
          {tags.filter((tag) => tag.is_active !== false || tag.id === original?.equipment_tag_id).map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.tag_code} {tag.equipment_name}</option>
          ))}
        </select>
      </Field>
      <Field id="schedule-notes" label="Notes (optional)" error={errors.notes} hint="Up to 500 characters.">
        <textarea rows={3} maxLength={500} {...fieldProps("schedule-notes", errors.notes, true)} value={values.notes} onChange={set("notes")} disabled={submitting} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButton} disabled={submitting}>{submitting ? "Saving schedule" : "Save schedule"}</button>
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>
    </form>
  );
}

function focusFirstError(prefix, errors) {
  const first = Object.keys(errors).find((key) => key !== "form");
  if (first && typeof document !== "undefined") document.getElementById(`${prefix}-${first}`)?.focus();
}

export default function ContractsPage({ user }) {
  const role = user?.role;
  const manageContracts = canManageContracts(role);
  const manageSchedules = canManageSchedules(role);
  const isViewer = role === "Client Viewer";

  const [phase, setPhase] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [lookupWarning, setLookupWarning] = useState("");
  const [contractRows, setContractRows] = useState([]);
  const [scheduleRows, setScheduleRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [tags, setTags] = useState([]);
  const [notice, setNotice] = useState(null);
  const [contractDraft, setContractDraft] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setLoadError("");
    const lookupCalls = [collections.list("clients")];
    if (manageSchedules) lookupCalls.push(collections.list("equipment_tags"));
    const [contractsResult, schedulesResult, clientsResult, tagsResult] = await Promise.allSettled([
      contracts.list(),
      maintenanceSchedules.list(),
      ...lookupCalls
    ]);

    const failed = [contractsResult, schedulesResult].find((result) => result.status === "rejected");
    if (failed) {
      // A 401 signs the person out through App; there is nothing to show here.
      if (failed.reason?.sessionExpired) return;
      setLoadError(failed.reason?.message || "Contracts could not be loaded.");
      setPhase("error");
      return;
    }

    try {
      setContractRows(asList(contractsResult.value, "contracts"));
      setScheduleRows(asList(schedulesResult.value, "maintenance schedules"));
    } catch (error) {
      setLoadError(error.message);
      setPhase("error");
      return;
    }

    const warnings = [];
    try {
      if (clientsResult.status === "rejected") throw clientsResult.reason;
      setClients(asList(clientsResult.value, "clients"));
    } catch (error) {
      setClients([]);
      warnings.push(`Client names could not be loaded (${error.message}).`);
    }
    if (manageSchedules) {
      try {
        if (tagsResult.status === "rejected") throw tagsResult.reason;
        setTags(asList(tagsResult.value, "equipment tags"));
      } catch (error) {
        setTags([]);
        warnings.push(`Equipment tags could not be loaded (${error.message}).`);
      }
    }
    setLookupWarning(warnings.join(" "));
    setPhase("ready");
  }, [manageSchedules]);

  useEffect(() => { load(); }, [load]);

  const clientNames = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const contractById = useMemo(() => new Map(contractRows.map((contract) => [contract.id, contract])), [contractRows]);
  const openContracts = useMemo(() => contractRows.filter(isContractOpen), [contractRows]);
  const today = todayIso();

  function openContractForm(mode, original = null) {
    setNotice(null);
    setScheduleDraft(null);
    setContractDraft({
      mode,
      original,
      errors: {},
      serverError: "",
      values: original
        ? { client_id: original.client_id, title: original.title, start_date: original.start_date, end_date: original.end_date, total_value: original.total_value ?? "", status: original.status }
        : { ...EMPTY_CONTRACT }
    });
  }

  function openScheduleForm(mode, original = null) {
    setNotice(null);
    setContractDraft(null);
    setScheduleDraft({
      mode,
      original,
      errors: {},
      serverError: "",
      values: original
        ? { contract_id: original.contract_id, equipment_tag_id: original.equipment_tag_id || "", frequency: original.frequency, next_due_date: original.next_due_date, notes: original.notes || "" }
        : { ...EMPTY_SCHEDULE }
    });
  }

  async function submitContract(event) {
    event.preventDefault();
    if (submitting || !contractDraft) return;
    const { errors, payload } = validateContractForm(contractDraft.values, { mode: contractDraft.mode, original: contractDraft.original });
    if (!payload) {
      setContractDraft({ ...contractDraft, errors, serverError: "" });
      focusFirstError("contract", errors);
      return;
    }
    setSubmitting(true);
    setContractDraft({ ...contractDraft, errors: {}, serverError: "" });
    try {
      const saved = contractDraft.mode === "create"
        ? await contracts.create(payload)
        : await contracts.update(contractDraft.original.id, payload);
      setContractDraft(null);
      setNotice({ kind: "contract", text: `Contract ${saved.contract_number} ${contractDraft.mode === "create" ? "created" : "updated"}.` });
      await load();
    } catch (error) {
      if (error.sessionExpired) return;
      setContractDraft((current) => (current ? { ...current, serverError: error.message } : current));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSchedule(event) {
    event.preventDefault();
    if (submitting || !scheduleDraft) return;
    const editing = scheduleDraft.mode === "edit";
    const contract = contractById.get(editing ? scheduleDraft.original.contract_id : scheduleDraft.values.contract_id) || null;
    const { errors, payload } = validateScheduleForm(scheduleDraft.values, { mode: scheduleDraft.mode, contract, original: scheduleDraft.original });
    if (!payload) {
      setScheduleDraft({ ...scheduleDraft, errors, serverError: "" });
      focusFirstError("schedule", errors);
      return;
    }
    setSubmitting(true);
    setScheduleDraft({ ...scheduleDraft, errors: {}, serverError: "" });
    try {
      if (editing) await maintenanceSchedules.update(scheduleDraft.original.id, payload);
      else await maintenanceSchedules.create(payload);
      setScheduleDraft(null);
      setNotice({ kind: "schedule", text: `Maintenance schedule ${editing ? "updated" : "created"}.` });
      await load();
    } catch (error) {
      if (error.sessionExpired) return;
      setScheduleDraft((current) => (current ? { ...current, serverError: error.message } : current));
    } finally {
      setSubmitting(false);
    }
  }

  const subtitle = manageContracts
    ? "Create service contracts and schedule preventative maintenance for each client."
    : manageSchedules
      ? "Schedule preventative maintenance against Draft and Active client contracts. Management maintains the contracts."
      : "Your organisation's service contracts and planned maintenance. This view is read-only.";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeaderBanner title="Contracts & Maintenance" subtitle={subtitle} iconPath={ICONS.document} />

      {notice && (
        <p role="status" data-evidence={`${notice.kind}-saved`} className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {notice.text}
        </p>
      )}

      {phase === "loading" && (
        <div role="status" aria-live="polite" data-evidence="contracts-loading" className="p-8 text-center text-gray-500">
          Loading contracts and maintenance schedules...
        </div>
      )}

      {phase === "error" && (
        <div data-evidence="contracts-load-error" className="space-y-3">
          <div role="alert"><ErrorBanner message={loadError} /></div>
          <button type="button" className={primaryButton} onClick={load}>Try again</button>
        </div>
      )}

      {phase === "ready" && (
        <div data-evidence="contracts-ready" className="space-y-6">
          {lookupWarning && (
            <div role="alert" data-evidence="contracts-lookup-warning"><ErrorBanner message={`${lookupWarning} Some names below may show as unavailable.`} /></div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section aria-labelledby="contracts-heading" className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 p-4">
                <h2 id="contracts-heading" className="flex items-center text-lg font-bold text-orac-slate">
                  <Icon path={ICONS.document} className="mr-2 h-5 w-5 text-orac-navy" />
                  Contracts <span className="ml-2 text-sm font-normal text-gray-500">{contractRows.length} on file</span>
                </h2>
                {manageContracts && !contractDraft && (
                  <button type="button" className={primaryButton} onClick={() => openContractForm("create")}>New contract</button>
                )}
              </div>

              {contractDraft && (
                <ContractForm
                  draft={contractDraft}
                  clients={clients}
                  submitting={submitting}
                  onChange={(values) => setContractDraft({ ...contractDraft, values })}
                  onSubmit={submitContract}
                  onCancel={() => setContractDraft(null)}
                />
              )}

              {contractRows.length === 0 ? (
                <div data-evidence="contracts-list-empty">
                  <PageEmptyState
                    iconPath={ICONS.document}
                    title={isViewer ? "No contracts on file" : "No contracts yet"}
                    subtitle={manageContracts
                      ? "Create the first contract, then add its maintenance schedules."
                      : isViewer
                        ? "Contracts for your organisation will appear here once they are set up."
                        : "Management creates contracts. Schedules can be added once one exists."}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <th scope="col" className="px-4 py-3">Contract</th>
                        <th scope="col" className="px-4 py-3">Client</th>
                        <th scope="col" className="px-4 py-3">Period</th>
                        <th scope="col" className="px-4 py-3">Total value</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                        <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {contractRows.map((contract) => (
                        <tr key={contract.id} className="align-top">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-orac-navy">{contract.contract_number}</p>
                            <p className="text-sm text-gray-800">{contract.title}</p>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">{clientNames.get(contract.client_id) || "Client unavailable"}</td>
                          <td className="px-4 py-4 text-sm text-gray-800 whitespace-nowrap">{contract.start_date} to {contract.end_date}</td>
                          <td className="px-4 py-4 text-sm text-gray-800 whitespace-nowrap">{formatMoney(contract.total_value)}</td>
                          <td className="px-4 py-4"><StatusPill status={contract.status} /></td>
                          <td className="px-4 py-4 text-right">
                            {manageContracts && isContractOpen(contract) && (
                              <button type="button" className={secondaryButton} onClick={() => openContractForm("edit", contract)} aria-label={`Edit contract ${contract.contract_number}`}>
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section aria-labelledby="schedules-heading" className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 p-4">
                <h2 id="schedules-heading" className="flex items-center text-lg font-bold text-orac-slate">
                  <Icon path={ICONS.clock} className="mr-2 h-5 w-5 text-orac-cyan" />
                  Preventative maintenance <span className="ml-2 text-sm font-normal text-gray-500">{scheduleRows.length} scheduled</span>
                </h2>
                {manageSchedules && !scheduleDraft && openContracts.length > 0 && (
                  <button type="button" className={primaryButton} onClick={() => openScheduleForm("create")}>Add schedule</button>
                )}
              </div>
              {manageSchedules && !scheduleDraft && openContracts.length === 0 && (
                <p data-evidence="schedules-need-contract" className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  Schedules can only be added to a Draft or Active contract. There is none yet.
                </p>
              )}

              {scheduleDraft && (
                <ScheduleForm
                  draft={scheduleDraft}
                  openContracts={openContracts}
                  contractById={contractById}
                  tags={tags}
                  submitting={submitting}
                  onChange={(values) => setScheduleDraft({ ...scheduleDraft, values })}
                  onSubmit={submitSchedule}
                  onCancel={() => setScheduleDraft(null)}
                />
              )}

              {scheduleRows.length === 0 ? (
                <div data-evidence="schedules-list-empty">
                  <PageEmptyState
                    iconPath={ICONS.clock}
                    title="No maintenance scheduled"
                    subtitle={manageSchedules
                      ? "Add a schedule to a Draft or Active contract to plan recurring maintenance."
                      : "Planned maintenance for your contracts will appear here."}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <th scope="col" className="px-4 py-3">Contract</th>
                        <th scope="col" className="px-4 py-3">Equipment</th>
                        <th scope="col" className="px-4 py-3">Frequency</th>
                        <th scope="col" className="px-4 py-3">Next due</th>
                        <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {scheduleRows.map((schedule) => {
                        const contract = contractById.get(schedule.contract_id);
                        const overdue = isOverdue(schedule, contract, today);
                        return (
                          <tr key={schedule.id} className="align-top">
                            <td className="px-4 py-4">
                              <p className="font-semibold text-orac-slate">{contract ? `${contract.contract_number} ${contract.title}` : "Contract unavailable"}</p>
                              {contract && !isContractOpen(contract) && (
                                <p className="mt-1 text-xs text-gray-500">This contract is {contract.status}, so the schedule is read-only.</p>
                              )}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {schedule.equipment_tag_code || (schedule.equipment_tag_id ? "Equipment tag unavailable" : "Whole contract")}
                            </td>
                            <td className="px-4 py-4">
                              <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">{schedule.frequency}</span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-800 whitespace-nowrap">
                              Next due {schedule.next_due_date}
                              {overdue && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Overdue</span>}
                              {schedule.notes && <p className="mt-1 text-sm text-gray-600 whitespace-normal">{schedule.notes}</p>}
                            </td>
                            <td className="px-4 py-4 text-right">
                              {manageSchedules && isContractOpen(contract) && (
                                <button type="button" className={secondaryButton} onClick={() => openScheduleForm("edit", schedule)} aria-label={`Edit schedule for ${contract.contract_number}`}>
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
