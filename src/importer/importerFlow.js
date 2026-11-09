// The two network steps of the Data Import page, with the API passed in so they can be
// tested without a server or a browser.
import { commitBody, fileProblem } from "./importerView.js";

export async function runPreview({ api, entity, file }) {
  const problem = fileProblem(file);
  if (problem) return { ok: false, message: problem };
  const csvText = await file.text();
  try {
    const preview = await api.preview(entity, csvText);
    return { ok: true, csvText, preview };
  } catch (error) {
    return { ok: false, message: error.message, sessionExpired: Boolean(error.sessionExpired), forbidden: error.status === 403 };
  }
}

export async function runCommit({ api, entity, csvText, preview, phrase, count }) {
  try {
    const result = await api.commit(entity, commitBody({ csvText, preview, phrase, count }));
    return { ok: true, result };
  } catch (error) {
    return { ok: false, message: error.message, code: error.code || "", sessionExpired: Boolean(error.sessionExpired), forbidden: error.status === 403 };
  }
}
