// CarSofit · función "ia": genera menús, cambia platos y rehace entrenos con Gemini.
// La clave GEMINI_API_KEY vive en los secretos de Supabase, nunca en la web.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODELS = [Deno.env.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"].filter(Boolean) as string[];

const SECTIONS = ["Frutería", "Carne y pescado", "Lácteos y huevos", "Panadería", "Despensa"];
const TOOLS = ["Thermomix", "Freidora de aire", "Olla GM", "Vitrocerámica", "Thermomix + sartén", "Freidora + Thermomix", "Thermomix (Varoma)", "Sin cocción"];

const DISH_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    kcal: { type: "INTEGER", description: "kcal de una ración estándar" },
    p: { type: "INTEGER", description: "proteína g" },
    c: { type: "INTEGER", description: "hidratos g" },
    g: { type: "INTEGER", description: "grasa g" },
    f: { type: "INTEGER", description: "fibra g" },
    time: { type: "STRING", description: "p. ej. '20 min'" },
    tool: { type: "STRING", enum: TOOLS },
    ing: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          n: { type: "STRING" },
          q: { type: "NUMBER" },
          u: { type: "STRING", enum: ["g", "ml", "ud", "pizca"] },
          sec: { type: "STRING", enum: SECTIONS },
        },
        required: ["n", "q", "u", "sec"],
      },
    },
    steps: { type: "ARRAY", items: { type: "STRING" }, description: "2-4 pasos cortos con programa exacto del aparato" },
    why: { type: "STRING", description: "1 frase: por qué es beneficioso" },
    micro: { type: "STRING", description: "1 frase: efecto en el microbioma" },
    sofia: { type: "STRING", description: "1 frase: tolerancia para Sofía (fructosa/colitis)" },
  },
  required: ["name", "kcal", "p", "c", "g", "f", "time", "tool", "ing", "steps", "why", "micro", "sofia"],
};
const DAY_SCHEMA = {
  type: "OBJECT",
  properties: { des: DISH_SCHEMA, com: DISH_SCHEMA, cen: DISH_SCHEMA, sna: DISH_SCHEMA },
  required: ["des", "com", "cen", "sna"],
};
const WEEK_SCHEMA = {
  type: "OBJECT",
  properties: { days: { type: "ARRAY", items: DAY_SCHEMA } },
  required: ["days"],
};
const SESSION_SCHEMA = {
  type: "OBJECT",
  properties: {
    k: { type: "STRING", enum: ["fuerza", "cardio", "movil"] },
    name: { type: "STRING" },
    min: { type: "INTEGER" },
    ex: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, dose: { type: "STRING" }, how: { type: "STRING" } },
        required: ["name", "dose", "how"],
      },
    },
  },
  required: ["k", "name", "min", "ex"],
};

const RULES = `Eres el nutricionista y entrenador personal de una pareja que vive en España (Talavera de la Reina). Respondes en español de España.
HOGAR
- Carlos: hombre, perder grasa y tonificar. Colesterol elevado sin tratamiento: dieta cardiosaludable (AOVE, pescado azul, avena, legumbre, poca grasa saturada, nada de embutidos ni bollería). Fascitis plantar: nada de saltos ni impacto; progresión caminar → correr.
- Sofía: mujer, comer bien y evitar brotes de colitis inespecífica. INTOLERANCIA A LA FRUCTOSA: prohibido manzana, pera, mango, sandía, cereza, higo, fruta desecada, zumos, miel, sirope de agave, jarabe de glucosa-fructosa, sorbitol, maltitol, xilitol y edulcorantes polioles. Cebolla y ajo solo como aceite infusionado o parte verde de la cebolleta. Espárragos y alcachofa no. Legumbres solo de bote enjuagadas y en ración moderada (lentejas mejor que garbanzos). Evita también champiñones y setas, coliflor, y usa boniato o calabaza solo en poca cantidad (ricos en polioles). Lácteos sin lactosa. Frutas permitidas: plátano firme, kiwi, naranja, mandarina, fresas, arándanos, frambuesas, piña, uva en poca cantidad, melón cantalupo.
- A ninguno le gusta: coliflor, judías verdes, salmón ahumado, berenjena al vapor o en guiso (frita o crujiente en freidora sí). Sofía no come nada crudo ni poco hecho: carne, pescado y huevo siempre bien cocinados.
- Las cantidades de "ing" son SIEMPRE para UNA sola ración de adulto (p. ej. 120-150 g de carne o pescado, 60-80 g de arroz o pasta en crudo), nunca para dos.
- Nada de embutidos, jamón, beicon ni carnes procesadas.
- Comen el mismo plato con raciones distintas (la app escala las raciones; tú das la ración estándar de un adulto, 350-650 kcal comida/cena, 300-450 desayuno, 120-220 tentempié).
- Aparatos: Thermomix TM6, freidora de aire Cosori Dual Blaze 10 L (dos zonas), olla a presión GM H y vitrocerámica. Da tiempos, temperaturas y velocidades concretas.
- Presupuesto de supermercado normal (300-400 €/mes): ingredientes de Mercadona o Lidl, nada exótico caro.
- Prioriza microbioma: variedad vegetal, fibra fermentable tolerada, polifenoles, técnicas que preserven nutrientes.
- Tentempiés tipo batch cooking que aguanten varios días (bizcochos proteicos sin polioles, etc.).
- Entreno en casa sin gimnasio: juego de mancuernas de 20 kg (10 kg por mano máx.), bandas elásticas, esterilla, zapatillas. Cardio preferido: caminar, evolucionando a correr.
Sé preciso y conciso. Las kcal y macros son estimaciones por ración estándar.`;

async function gemini(prompt: string, schema: unknown, maxTokens: number, perTryMs: number, deadline: number) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("Falta el secreto GEMINI_API_KEY en Supabase.");
  let lastErr = "";
  for (const model of MODELS) {
    const left = deadline - Date.now();
    if (left < 8000) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(perTryMs, left));
    let r: Response;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: RULES }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.8, maxOutputTokens: maxTokens },
        }),
      });
    } catch {
      clearTimeout(timer); lastErr = "Gemini tarda demasiado ahora mismo. Prueba en unos minutos."; continue;
    }
    clearTimeout(timer);
    const data = await r.json().catch(() => ({}));
    if (r.status === 404) { lastErr = `Modelo ${model} no disponible`; continue; }
    if (r.status >= 500) { lastErr = "Gemini está saturado ahora mismo. Prueba en unos minutos."; continue; }
    if (r.status === 429) { lastErr = "Se ha llegado al límite gratuito de Gemini por ahora. Prueba en un minuto."; continue; }
    if (!r.ok) { lastErr = `Gemini (${model}): ${data?.error?.message ?? r.statusText}`; continue; }
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    try { return { model, out: JSON.parse(text) }; }
    catch { lastErr = "La IA devolvió una respuesta incompleta. Vuelve a intentarlo."; continue; }
  }
  throw new Error(lastErr || "No hay modelo de Gemini disponible.");
}

const toApp = (d: any, slot: string) => ({
  slot, name: d.name, kcal: d.kcal, p: d.p, c: d.c, g: d.g, f: d.f, time: d.time, tool: d.tool,
  ing: (d.ing ?? []).map((x: any) => [x.n, x.q, x.u, x.sec]),
  steps: d.steps, why: d.why, micro: d.micro, sofia: d.sofia, ai: true,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user?.email) return json({ error: "Inicia sesión para usar la IA." }, 401);
    const { data: mem } = await sb.from("miembros").select("persona").eq("email", user.email.toLowerCase());
    if (!mem?.length) return json({ error: "Correo no autorizado." }, 403);

    const body = await req.json();
    const [{ data: est }, { data: sin }] = await Promise.all([
      sb.from("estado").select("clave,valor").eq("clave", "profiles"),
      sb.from("sintomas").select("persona,plato_nombre,malestar,sintomas").order("fecha", { ascending: false }).limit(200),
    ]);
    const profiles = est?.[0]?.valor ?? {};
    // Resumen del diario digestivo por plato
    const agg: Record<string, { n: number; sum: number; sy: Record<string, number> }> = {};
    (sin ?? []).forEach((s: any) => {
      const k = `${s.persona}|${s.plato_nombre}`;
      const o = (agg[k] ??= { n: 0, sum: 0, sy: {} }); o.n++; o.sum += s.malestar;
      (s.sintomas ?? []).forEach((x: string) => (o.sy[x] = (o.sy[x] ?? 0) + 1));
    });
    const digest = Object.entries(agg).map(([k, o]) => {
      const [p, name] = k.split("|");
      return `${p === "sofia" ? "Sofía" : "Carlos"} · ${name}: malestar medio ${(o.sum / o.n).toFixed(1)}/10 en ${o.n} registros${Object.keys(o.sy).length ? " (" + Object.keys(o.sy).join(", ") + ")" : ""}`;
    });
    const ctx = `PERFILES ACTUALES (JSON): ${JSON.stringify(profiles)}
DIARIO DIGESTIVO: ${digest.length ? digest.join("; ") : "sin registros aún"}.
Evita o modifica los platos con malestar medio ≥ 5; repite o inspírate en los de malestar ≤ 2.`;

    const deadline = Date.now() + 140000;
    if (body.accion === "semana") {
      const TEMAS = [
        "Lunes: comida de pollo; cena ligera de verdura con huevo",
        "Martes: comida de legumbre; cena de pescado blanco",
        "Miércoles: comida de pescado azul; cena de pavo",
        "Jueves: comida de arroz o pasta con marisco o pollo; cena de huevo",
        "Viernes: comida de legumbre; cena de pescado azul",
        "Sábado: comida saludable para compartir; cena tipo pizza o tosta casera",
        "Domingo: comida de carne blanca asada; cena de crema de verduras",
      ];
      const base = `${ctx}
Platos de la semana anterior, para no repetir demasiado: ${(body.anteriores ?? []).join(", ")}.
Petición de la pareja para esta semana: ${body.peticion || "ninguna en especial"}.
Cada día: desayuno (des), comida (com), cena (cen) y tentempié (sna). Verduras distintas cada día; los tentempiés, tipo batch cooking que aguanten varios días.`;
      const half = (temas: string[]) => gemini(`${base}
Diseña SOLO estos ${temas.length} días, en este orden, siguiendo la guía (la petición de la pareja manda sobre la guía):
${temas.join("\n")}
Devuelve "days" con exactamente ${temas.length} elementos.`, WEEK_SCHEMA, 16000, 75000, deadline);
      const [a, b] = await Promise.all([half(TEMAS.slice(0, 4)), half(TEMAS.slice(4))]);
      const raw = [...(a.out.days ?? []).slice(0, 4), ...(b.out.days ?? []).slice(0, 3)];
      if (raw.length !== 7) throw new Error("La IA no devolvió los 7 días. Vuelve a intentarlo.");
      const days = raw.map((d: any) => ({
        des: toApp(d.des, "des"), com: toApp(d.com, "com"), cen: toApp(d.cen, "cen"), sna: toApp(d.sna, "sna"),
      }));
      return json({ model: a.model, days });
    }

    if (body.accion === "plato") {
      const prompt = `${ctx}
Sustituye este plato del ${body.dia} (${body.franjaNombre}): «${body.actual}».
Resto de platos de ese día: ${(body.otros ?? []).join(", ")}.
Petición: ${body.peticion || "otra opción distinta, igual de saludable"}.
Devuelve un único plato para la misma franja.`;
      const { model, out } = await gemini(prompt, DISH_SCHEMA, 4096, 45000, deadline);
      return json({ model, dish: toApp(out, body.franja) });
    }

    if (body.accion === "entreno") {
      const quien = body.persona === "sofia" ? "Sofía" : "Carlos";
      const prompt = `${ctx}
Rehaz la sesión de entrenamiento de ${quien} del ${body.dia}.
Sesión actual: ${JSON.stringify(body.actual)}.
Petición: ${body.peticion || "una variante distinta con el mismo objetivo"}.
Da entre 3 y 8 ejercicios con dosis (series × repeticiones, tiempo o km) y una frase de técnica. Termina con estiramiento de fascia plantar si es Carlos.`;
      const { model, out } = await gemini(prompt, SESSION_SCHEMA, 4096, 45000, deadline);
      return json({ model, session: out });
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
