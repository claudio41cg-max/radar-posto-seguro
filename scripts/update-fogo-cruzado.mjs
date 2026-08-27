import { mkdir, writeFile } from "node:fs/promises";

const API = "https://api-service.fogocruzado.org.br/api/v2";
const email = process.env.FOGO_EMAIL?.trim();
const password = process.env.FOGO_PASSWORD?.trim();

if (!email || !password) {
  throw new Error("Segredos FOGO_CRUZADO_EMAIL e PASS123 não configurados.");
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || (body.code && body.code >= 400)) {
    throw new Error(`Fogo Cruzado respondeu ${response.status}: ${body.msg || "erro desconhecido"}`);
  }
  return { body, headers: response.headers };
}

const login = await api("/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password })
});

const token = login.body?.data?.accessToken;
if (!token) throw new Error("A API não retornou o token de acesso.");

const headers = { authorization: `Bearer ${token}` };
const cities = await api("/cities?cityName=RIO%20DE%20JANEIRO", { headers });
const city = cities.body?.data?.find(
  item => String(item.name || "").toUpperCase() === "RIO DE JANEIRO"
);

if (!city?.id) throw new Error("Município do Rio de Janeiro não encontrado na API.");

const finalDate = new Date();
const initialDate = new Date(finalDate);
initialDate.setDate(initialDate.getDate() - 7);
const ymd = date => date.toISOString().slice(0, 10);

const query = new URLSearchParams({
  order: "DESC",
  page: "1",
  take: "100",
  initialdate: ymd(initialDate),
  finaldate: ymd(finalDate)
});
query.append("idCities", city.id);

const result = await api(`/occurrences?${query}`, { headers });
const occurrences = (result.body?.data || []).map(item => ({
  id: item.id,
  documentNumber: item.documentNumber ?? null,
  date: item.date,
  address: item.address || "",
  neighborhood: item.neighborhood?.name || "",
  subNeighborhood: item.subNeighborhood?.name || "",
  locality: item.locality?.name || item.locality || "",
  latitude: Number(item.latitude),
  longitude: Number(item.longitude),
  reason: item.contextInfo?.mainReason?.name || "Não informado",
  policeAction: Boolean(item.policeAction),
  agentPresence: Boolean(item.agentPresence),
  victims: (item.victims || []).map(victim => ({
    situation: victim.situation || "",
    personType: victim.personType || ""
  }))
})).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

const output = {
  generatedAt: new Date().toISOString(),
  source: {
    name: "Instituto Fogo Cruzado",
    url: "https://fogocruzado.org.br/",
    api: "https://api.fogocruzado.org.br/"
  },
  scope: {
    city: "Rio de Janeiro",
    state: "Rio de Janeiro",
    days: 7
  },
  count: occurrences.length,
  lastUpdate: result.headers.get("x-last-update"),
  occurrences
};

await mkdir("data", { recursive: true });
await writeFile("data/fogo-cruzado.json", JSON.stringify(output, null, 2) + "\n");
console.log(`${occurrences.length} ocorrências recentes salvas.`);
