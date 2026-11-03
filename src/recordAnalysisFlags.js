// Both this UI gate and the backend ORAC_RECORD_TRAIL_V1 gate must be enabled
// deliberately. A browser setting cannot enable the server capability.
export const recordAnalysisVisible = () => import.meta.env.VITE_ORAC_RECORD_TRAIL_V1 === "enabled";
