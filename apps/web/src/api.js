export async function api(path, method = 'GET', body) {
  const response = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed.');
  return data;
}
