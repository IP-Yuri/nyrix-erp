const API_BASE = "/api";

async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem("token");
    const headers = {
        "Content-Type": "application/json",
        ...options.headers
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    
    // Remove Content-Type if we're sending FormData
    if (options.body instanceof FormData) {
        delete headers["Content-Type"];
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        if (response.status === 401 && endpoint !== "/auth/login") {
            window.location.href = "/";
            return null;
        }
        if (response.status === 403) {
            alert("403 Forbidden: Access Denied");
            window.location.href = "/";
            return null;
        }
        return response;
    } catch (err) {
        console.error("Fetch error:", err);
        throw err;
    }
}
