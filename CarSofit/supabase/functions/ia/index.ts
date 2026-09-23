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
// Comida de tupper: además, cuándo prepararla, cuánto aguanta y cómo calentarla
const TUPPER_DISH = {
  ...DISH_SCHEMA,
  properties: {
    ...DISH_SCHEMA.properties,
    prep: { type: "STRING", description: "cuándo y cómo prepararlo, p. ej. 'Domingo por la tarde en batch (sirve lunes y martes)' o 'La tarde anterior, 20 min'" },
    nevera: { type: "INTEGER", description: "días que aguanta en la nevera" },
    recalentar: { type: "STRING", description: "cómo calentarlo en el microondas del trabajo, p. ej. '2-3 min a 800 W, remover a mitad'" },
  },
  required: [...DISH_SCHEMA.required, "prep", "nevera", "recalentar"],
};
const TUPPER = `COMIDA DE TUPPER (se la llevan al hospital): llegan de trabajar a las 15:00 sin ganas de cocinar, así que la comida se cocina la tarde anterior o en una sesión de batch cooking (domingo o miércoles por la tarde), se guarda en la nevera en táper de vidrio y al día siguiente solo se calienta 2-3 min en el microondas (o se come templada). Nada que haya que terminar al momento.
Buenas opciones: guisos y legumbres, arroz o pasta con proteína, pollo o pavo guisado o al horno con verduras asadas, albóndigas en salsa, pescado en salsa o al horno (nunca frito ni rebozado, se reblandece), crema de verduras + proteína, ensaladas templadas de legumbre o cereal con verdura COCINADA (Sofía no come crudo).
Seguridad: enfriar antes de 2 h, nevera a 4 °C, máximo 3 días (arroz y pasta cocidos, 1-2 días y enfriados rápido), recalentar hasta que humee. Aprovecha una misma elaboración para dos días si encaja. La cena sí puede ser más elaborada.`;
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
const WEEK_SCHEMA_T = {
  type: "OBJECT",
  properties: { days: { type: "ARRAY", items: { ...DAY_SCHEMA, properties: { ...DAY_SCHEMA.properties, com: TUPPER_DISH } } } },
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

const FRANJAS = ["des", "com", "cen", "sna"];
const FR: Record<string, string> = { des: "desayuno", com: "comida", cen: "cena", sna: "tentempié" };
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const TARGETS_SCHEMA = {
  type: "OBJECT",
  properties: {
    objetivos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { dia: { type: "INTEGER", description: "0 lunes … 6 domingo" }, franja: { type: "STRING", enum: FRANJAS } },
        required: ["dia", "franja"],
      },
    },
    aviso: { type: "STRING", description: "si no hay nada que cambiar, explica por qué en 1 frase" },
  },
  required: ["objetivos"],
};
const EATEN_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", description: "nombre corto de lo que ha comido" },
    kcal: { type: "INTEGER" }, p: { type: "INTEGER" }, c: { type: "INTEGER" }, g: { type: "INTEGER" }, f: { type: "INTEGER" },
    nota: { type: "STRING", description: "1-2 frases: valoración y consejo para el resto del día" },
  },
  required: ["name", "kcal", "p", "c", "g", "f", "nota"],
};

async function gemini(prompt: string, schema: unknown, maxTokens: number, perTryMs: number, deadline: number, temperature = 0.8) {
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
          generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature, maxOutputTokens: maxTokens },
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
  ...(d.prep ? { tupper: true, prep: d.prep, nevera: d.nevera, recalentar: d.recalentar } : {}),
});
const sinTupper = (x: any) => { delete x.tupper; delete x.prep; delete x.nevera; delete x.recalentar; return x; };

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
      const tdias: number[] = body.tupper?.dias ?? [];
      const base = `${ctx}
Platos de la semana anterior, para no repetir demasiado: ${(body.anteriores ?? []).join(", ")}.
Petición de la pareja para esta semana: ${body.peticion || "ninguna en especial"}.
Cada día: desayuno (des), comida (com), cena (cen) y tentempié (sna). Verduras distintas cada día; los tentempiés, tipo batch cooking que aguanten varios días.${tdias.length ? `
${TUPPER}
Son de tupper las comidas (com) de: ${tdias.map((i) => DIAS[i]).join(", ")}. En los demás días, deja prep, nevera y recalentar vacíos o en 0.` : ""}`;
      const half = (temas: string[]) => gemini(`${base}
Diseña SOLO estos ${temas.length} días, en este orden, siguiendo la guía (la petición de la pareja manda sobre la guía):
${temas.join("\n")}
Devuelve "days" con exactamente ${temas.length} elementos.`, tdias.length ? WEEK_SCHEMA_T : WEEK_SCHEMA, 16000, 75000, deadline);
      const [a, b] = await Promise.all([half(TEMAS.slice(0, 4)), half(TEMAS.slice(4))]);
      const raw = [...(a.out.days ?? []).slice(0, 4), ...(b.out.days ?? []).slice(0, 3)];
      if (raw.length !== 7) throw new Error("La IA no devolvió los 7 días. Vuelve a intentarlo.");
      const days = raw.map((d: any, i: number) => ({
        des: sinTupper(toApp(d.des, "des")), com: tdias.includes(i) ? toApp(d.com, "com") : sinTupper(toApp(d.com, "com")),
        cen: sinTupper(toApp(d.cen, "cen")), sna: sinTupper(toApp(d.sna, "sna")),
      }));
      return json({ model: a.model, days });
    }

    // Cambia solo los platos o días que se pidan (nunca la semana entera de golpe)
    if (body.accion === "cambios") {
      const semana: Record<string, string>[] = body.semana ?? [];
      const listado = semana.map((d, i) => `${i} ${DIAS[i]}: ` + Object.entries(d).map(([s, n]) => `${s} (${FR[s]}) «${n}»`).join("; ")).join("\n");
      let objetivos: { dia: number; franja: string }[] = body.objetivos ?? [];
      if (!objetivos.length) {
        const { out } = await gemini(`Menú actual de la semana (índice de día 0-6):
${listado}
Hoy es ${DIAS[body.hoy]} (índice ${body.hoy}). En pantalla está el ${DIAS[body.diaVisto]} (índice ${body.diaVisto}).
Petición: «${body.peticion}».
Di qué platos hay que sustituir. Reglas: cambia SOLO lo que la petición pida de forma explícita; si pide un día entero, sus 4 franjas (des, com, cen, sna) salvo las que excluya; si no dice día, usa el día en pantalla; "hoy" y "mañana" se cuentan desde hoy; si pide algo general (p. ej. "más pescado") elige como mucho 3 platos donde mejor encaje. Nunca más de 8.`,
          TARGETS_SCHEMA, 1024, 30000, deadline, 0.2);
        objetivos = out.objetivos ?? [];
        if (!objetivos.length) return json({ cambios: [], aviso: out.aviso ?? "" });
      }
      const vistos = new Set<string>();
      objetivos = objetivos.filter((o) => {
        const k = `${o.dia}-${o.franja}`;
        if (!Number.isInteger(o.dia) || o.dia < 0 || o.dia > 6 || !FR[o.franja] || vistos.has(k)) return false;
        vistos.add(k); return true;
      });
      if (objetivos.length > 8) return json({ error: "Son demasiados platos de golpe: pide como mucho dos días completos a la vez." }, 400);
      const porDia: Record<number, string[]> = {};
      objetivos.forEach((o) => (porDia[o.dia] ??= []).push(o.franja));
      const todos = semana.flatMap((d) => Object.values(d));
      const tdias: number[] = body.tupper?.dias ?? [];
      const res = await Promise.all(Object.entries(porDia).map(async ([dia, franjas]) => {
        const d = semana[+dia] ?? {};
        const esT = (f: string) => f === "com" && tdias.includes(+dia);
        const schema = { type: "OBJECT", properties: Object.fromEntries(franjas.map((f) => [f, esT(f) ? TUPPER_DISH : DISH_SCHEMA])), required: franjas };
        const quedan = Object.entries(d).filter(([f]) => !franjas.includes(f)).map(([f, n]) => `${FR[f]} «${n}»`).join(", ");
        const { out } = await gemini(`${ctx}
Sustituye estos platos del ${DIAS[+dia]}:
${franjas.map((f) => `- ${f} (${FR[f]}): ahora «${d[f] ?? "?"}»`).join("\n")}
Platos que se quedan ese día: ${quedan || "ninguno"}.
Resto de la semana, para no repetir: ${todos.join(", ")}.
Petición: ${body.peticion || "otra opción distinta, igual de saludable"}.
Devuelve un plato nuevo, distinto del actual, para cada franja indicada.${franjas.some(esT) ? `
${TUPPER}
La comida (com) de este día es de tupper.` : ""}`, schema, 4096 * franjas.length, 75000, deadline);
        return franjas.filter((f) => out?.[f]).map((f) => ({ dia: +dia, franja: f, plato: esT(f) ? toApp(out[f], f) : sinTupper(toApp(out[f], f)) }));
      }));
      return json({ cambios: res.flat() });
    }

    // Registra lo que se ha comido fuera del plan y lo estima
    if (body.accion === "comido") {
      const quien = body.persona === "sofia" ? "Sofía" : "Carlos";
      const foco = body.persona === "sofia"
        ? "avisa si lleva fructosa, polioles, cebolla o ajo u otros desencadenantes de colitis"
        : "fíjate en la grasa saturada por el colesterol";
      const { model, out } = await gemini(`${ctx}
${quien} no ha seguido el plan en la ${body.franjaNombre} del ${body.dia} (tocaba «${body.plan}»). Lo que ha comido de verdad: «${body.descripcion}».
Estima kcal y macros de LO QUE HA COMIDO, en la cantidad que describe (si no da cantidades, una ración normal de adulto en España).
En "nota", 1-2 frases amables: valoración según su salud y objetivo (${foco}) y un consejo concreto para el resto del día.`,
        EATEN_SCHEMA, 1024, 40000, deadline, 0.3);
      return json({ model, comido: { name: out.name, kcal: out.kcal, p: out.p, c: out.c, g: out.g, f: out.f, nota: out.nota } });
    }

    // Receta propia añadida a mano: se pasa al formato de la app sin cambiar el plato
    if (body.accion === "receta") {
      const franja = FR[body.franja] ? body.franja : "com";
      const prompt = `${ctx}
Esta es una receta propia de la pareja. Pásala al formato de la app SIN cambiar el plato: mismos ingredientes y misma elaboración.
Nombre: ${body.nombre}
Franja: ${FR[franja]}
Raciones que salen: ${body.raciones || 2}
Ingredientes (para todas las raciones): ${body.ingredientes || "(no indicados: dedúcelos del nombre)"}
Elaboración: ${body.pasos || "(no indicada: propón una sencilla)"}
${body.tiempo ? `Tiempo: ${body.tiempo}. ` : ""}${body.aparato ? `Aparato: ${body.aparato}.` : ""}
Divide las cantidades para UNA ración. Estima kcal y macros por ración${body.kcal ? ` (ellos calculan unas ${body.kcal} kcal por ración)` : ""}. Pasos en 2-5 frases con programas concretos del aparato. En "sofia", di con sinceridad si le conviene (fructosa, polioles, cebolla o ajo, crudo) y cómo adaptarla.`;
      const { model, out } = await gemini(prompt, DISH_SCHEMA, 4096, 45000, deadline, 0.3);
      return json({ model, dish: sinTupper(toApp(out, franja)) });
    }

    if (body.accion === "plato") {
      const prompt = `${ctx}
Sustituye este plato del ${body.dia} (${body.franjaNombre}): «${body.actual}».
Resto de platos de ese día: ${(body.otros ?? []).join(", ")}.
Petición: ${body.peticion || "otra opción distinta, igual de saludable"}.
Devuelve un único plato para la misma franja.${body.tupper ? `
${TUPPER}
Este plato es la comida de tupper.` : ""}`;
      const { model, out } = await gemini(prompt, body.tupper ? TUPPER_DISH : DISH_SCHEMA, 4096, 45000, deadline);
      return json({ model, dish: body.tupper ? toApp(out, body.franja) : sinTupper(toApp(out, body.franja)) });
    }

    if (body.accion === "entreno") {
      const quien = body.persona === "sofia" ? "Sofía" : "Carlos";
      // Pesos registrados: último y anterior de cada ejercicio, para proponer la progresión
      const { data: cargas } = await sb.from("cargas").select("fecha,ejercicio,peso,reps")
        .eq("persona", body.persona).order("fecha", { ascending: false }).limit(60);
      const porEj: Record<string, { fecha: string; peso: number; reps: number | null }[]> = {};
      (cargas ?? []).forEach((c: any) => { const l = (porEj[c.ejercicio] ??= []); if (l.length < 2) l.push(c); });
      const pesos = Object.entries(porEj).map(([ej, l]) =>
        `${ej}: ${l[0].peso} kg${l[0].reps ? ` × ${l[0].reps}` : ""} (${l[0].fecha})${l[1] ? `, antes ${l[1].peso} kg (${l[1].fecha})` : ""}`);
      const prompt = `${ctx}
Rehaz la sesión de entrenamiento de ${quien} del ${body.dia}.
Sesión actual: ${JSON.stringify(body.actual)}.
Pesos registrados por ${quien}: ${pesos.length ? pesos.join("; ") : "ninguno todavía"}.
Petición: ${body.peticion || "una variante distinta con el mismo objetivo"}.
Da entre 3 y 8 ejercicios con dosis (series × repeticiones, tiempo o km) y una frase de técnica. Si un ejercicio lleva mancuernas y hay peso registrado, pon en "dose" el peso recomendado (p. ej. "3 × 12 · 10 kg"): sube 1-2 kg si la última vez completó las repeticiones, mantén si no. Nombra los ejercicios igual que en los registros para poder comparar. Termina con estiramiento de fascia plantar si es Carlos.`;
      const { model, out } = await gemini(prompt, SESSION_SCHEMA, 4096, 45000, deadline);
      return json({ model, session: out });
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
