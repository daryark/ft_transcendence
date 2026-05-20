import { getSessionToken } from "./session";

export const authFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = getSessionToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
};
