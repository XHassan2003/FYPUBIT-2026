// Connection details for the Python recommendation service (see service/).
//
// This MUST be the machine's LAN address, not localhost — on a phone,
// `localhost` is the phone. Find it with `ipconfig` on Windows or `ifconfig` on
// macOS, and update it whenever you move to a different network.
export const API_BASE_URL = "http://192.168.100.72:8000";

// How long to wait before giving up and styling the look on-device instead.
// Short on purpose: a laptop that is asleep or on another network should cost
// the user a moment, not a spinner that never resolves.
export const API_TIMEOUT_MS = 4000;
