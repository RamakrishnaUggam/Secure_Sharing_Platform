const state = {
	startedAt: Date.now(),
	totalRequests: 0,
	apiRequests: 0,
	errors: 0,
	byGroup: Object.create(null)
};

function groupForPath(pathname) {
	const p = String(pathname || "");
	if (p.startsWith("/api/admin")) return "/api/admin";
	if (p.startsWith("/api/files")) return "/api/files";
	if (p.startsWith("/api/me")) return "/api/me";
	if (p.startsWith("/api/account")) return "/api/account";
	if (p.startsWith("/health")) return "/health";
	if (p.startsWith("/api/")) return "/api/other";
	return "/other";
}

export function metricsMiddleware() {
	return function (req, res, next) {
		state.totalRequests += 1;
		if (String(req.path || "").startsWith("/api/")) state.apiRequests += 1;

		const group = groupForPath(req.path);
		state.byGroup[group] = (state.byGroup[group] || 0) + 1;

		res.on("finish", () => {
			if (res.statusCode >= 400) state.errors += 1;
		});

		next();
	};
}

export function getMetricsSnapshot() {
	return {
		startedAt: new Date(state.startedAt).toISOString(),
		uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
		totalRequests: state.totalRequests,
		apiRequests: state.apiRequests,
		errors: state.errors,
		byGroup: { ...state.byGroup }
	};
}
