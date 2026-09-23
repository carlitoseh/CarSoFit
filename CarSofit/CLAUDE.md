# CarSofit — contexto del proyecto

App web instalable (PWA) de nutrición, entreno en casa y seguimiento para Carlos y Sofía.
Proyecto nuevo, independiente de la antigua web de cocina.

## Arquitectura (coste 0 €)
- Frontend: HTML + CSS + JS sin build (`index.html`). PWA con `manifest.webmanifest` y `sw.js`.
- Publicación: GitHub Pages.
- Datos y cuentas (fase 2): Supabase gratuito. Todo visible para los dos usuarios.
- IA (fase 3): Gemini Flash, plan gratuito, llamado desde una Supabase Edge Function (la clave nunca va en el frontend).
- Móviles: Carlos Android (Samsung S24 Ultra, Chrome) · Sofía iPhone (Safari → Compartir → Añadir a pantalla de inicio).

## Perfiles
- Carlos: 28 años, 176 cm, hombre, 91 kg (23/09/2026), actividad sedentaria-moderada.
  Objetivo: perder grasa y peso, tonificar. Fascitis plantar: sin saltos; progresión andar → correr.
  No le gusta: coliflor, judías verdes, salmón ahumado.
- Sofía: nacida el 9/10/1999 (edad calculada sola), 160 cm, mujer, 60 kg (23/09/2026). Objetivo: comer bien y evitar brotes de colitis.
  Intolerancia a la fructosa + colitis inespecífica. No le gusta la comida cruda o poco hecha.
- Los dos: berenjena al vapor o en guiso no; frita/crujiente sí.
- Raciones distintas para cada uno: la app escala cada plato al objetivo calórico de cada persona.

## Reglas nutricionales para la IA
- Sofía: evitar manzana, pera, mango, sandía, miel, sirope de agave, zumos, fruta desecada y polioles (sorbitol, maltitol, xilitol). Cebolla y ajo solo en aceite infusionado o parte verde de cebolleta.
- Carlos: dieta cardiosaludable (colesterol elevado): AOVE, pescado azul, avena, legumbre, poca grasa saturada.
- Cada receta: kcal por ración de cada uno, macros, por qué es beneficiosa, efecto en el microbioma, técnica de cocción, pasos por aparato (Thermomix TM6, freidora de aire Cosori Dual Blaze 10 L, olla GM H, vitrocerámica).
- Las kcal NO las calcula la IA: la IA devuelve ingredientes en gramos y la app calcula con BEDCA.

## Material de entreno
Juego de mancuernas de 20 kg, bandas, esterilla, zapatillas. Nada de gimnasio. 4-5 días/semana, sobre todo cardio + 2 días de fuerza; días configurables en la app.

## Archivos
- `app.html`: código fuente de la app (también sirve como vista previa sin nube).
- `build.py`: genera `index.html` (versión instalable conectada a Supabase). Ejecutar tras cada cambio en `app.html`.
- `vendor/supabase.js`: librería de Supabase (v2.117.1) incluida en local para que funcione sin CDN.
- Diseño: siempre tonos claros, sin modo oscuro.

## Supabase (proyecto `carsofit`, ref jlkjvopynizxpvaxwdqr, región eu-west-3)
- `miembros` (email, persona): lista de correos autorizados. Solo ellos leen y escriben (RLS con `privado.es_miembro()`).
  Al registrarse, un correo de la lista queda confirmado automáticamente (trigger `privado.autoconfirmar_miembro`).
- `estado` (clave, valor jsonb): claves week, shop, extras, done, profiles. Compartido y en tiempo real.
- `mediciones` (persona, fecha, peso, grasa) · única por persona y día.
- `sintomas` (persona, fecha, franja, plato_id, plato_nombre, malestar 0-10, sintomas[], nota) · diario digestivo por comida.

## Hoja de ruta
1. [x] Prototipo navegable con datos de ejemplo (este archivo).
2. [x] Supabase: tablas, seguridad, login de los dos y sincronización en tiempo real. Diario digestivo por comida.
   [ ] Añadir el correo de Sofía a `miembros`.
3. [ ] Edge Function + Gemini: generar semana, cambiar plato, rehacer sesión; cálculo con BEDCA; usar el diario digestivo (platos con malestar medio ≥ 5 en 3+ registros se evitan).
4. [ ] Publicar en GitHub Pages e instalar en los dos móviles.
