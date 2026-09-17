const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

export async function getPublicStatus() {
  if (!baseUrl) return null;
  const response = await fetch(`${baseUrl}/api/public/status`);
  if (!response.ok) throw new Error("Status request failed");
  return response.json();
}
