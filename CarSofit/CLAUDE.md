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
- `supabase/functions/ia/index.ts`: función de IA desplegada en Supabase (la despliega Claude con el conector de Supabase).
- `vendor/supabase.js`: librería de Supabase (v2.117.1) incluida en local para que funcione sin CDN.
- `ejercicio3d.js` + `vendor/three.module.min.js` (Three.js r170): visor 3D de ejercicios. Maniquí articulado con posturas por ejercicio (ANIMS), músculo trabajado en rojo con brillo pulsante, play/pausa y girar arrastrando. Se carga con import dinámico solo al abrir un ejercicio. En app.html: ANIM_OF (clave EX → animación), ANIM_RX (nombres de ejercicios de la IA → animación), ANIM_MUS (músculos) y FOOD_EMO (emoji de cada plato según su nombre).
- `publicar.py`: ejecuta build.py, copia todo a un clon del repo en `%LOCALAPPDATA%\CarSofit-publicar\repo` (subcarpeta CarSofit/) y hace commit + push. Esta carpeta de OneDrive es la fuente de verdad: lo que haya en GitHub se sobrescribe.

## Publicar tras cada cambio (obligatorio)
1. Al terminar cualquier cambio, sin esperar a que lo pidan: `python publicar.py` y comprobar que dice «Publicado en GitHub».
2. Si cambia `supabase/functions/ia/index.ts`: desplegar la función `ia` con el conector de Supabase (verify_jwt true) y después `python publicar.py --funcion-desplegada`.
3. Si hace falta cambiar tablas o RLS: migración con el conector de Supabase.
4. Si cambian archivos que la app guarda sin conexión, subir la versión de `CACHE` en `sw.js`.
- Diseño: siempre tonos claros, sin modo oscuro.

## Supabase (proyecto `carsofit`, ref jlkjvopynizxpvaxwdqr, región eu-west-3)
- `miembros` (email, persona): lista de correos autorizados. Solo ellos leen y escriben (RLS con `privado.es_miembro()`).
  Al registrarse, un correo de la lista queda confirmado automáticamente (trigger `privado.autoconfirmar_miembro`).
- `estado` (clave, valor jsonb): claves week, shop, extras, done, profiles, dishes, sessions, eaten. Compartido y en tiempo real.
  `eaten` = comidas fuera de plan por persona: clave "persona|AAAA-MM-DD|franja" → {name, kcal, p, c, g, f, nota, desc, plan}.
- `mediciones` (persona, fecha, peso, grasa) · única por persona y día.
- `sintomas` (persona, fecha, franja, plato_id, plato_nombre, malestar 0-10, sintomas[], nota) · diario digestivo por comida.

## Hoja de ruta
1. [x] Prototipo navegable con datos de ejemplo (este archivo).
2. [x] Supabase: tablas, seguridad, login de los dos y sincronización en tiempo real. Diario digestivo por comida.
   [x] Correo de Sofía añadido a `miembros`.
3. [x] Edge Function `ia` (supabase/functions/ia/index.ts) + Gemini (secreto GEMINI_API_KEY): rehacer semana (2 llamadas en paralelo), cambiar plato, rehacer sesión de entreno. Lee perfiles y diario digestivo. Modelos en cascada: gemini-flash-latest → gemini-2.5-flash → gemini-flash-lite-latest (opcional secreto GEMINI_MODEL).
   Platos de IA en estado.dishes, sesiones de IA en estado.sessions (clave persona-díaíndice).
   [ ] Pendiente: calcular kcal con BEDCA (ahora son estimaciones de la IA).
4. [x] Menú: botón «Compartir semana» que genera un folio A4 horizontal (canvas 2339×1654, días en columnas y desayuno/comida/cena en filas) como imagen PNG para WhatsApp y como PDF para imprimir (PDF hecho a mano con la imagen JPEG, sin librerías); también como texto (wa.me).
5. [x] IA por partes (acción `cambios`): ya no se rehace la semana entera desde la app. Se escribe qué cambiar («la cena del martes», «rehaz el jueves») o se pulsa «Rehacer el <día> entero»; la IA primero decide qué platos tocar (máx. 8) y luego los genera por día en paralelo. Botón «Deshacer» en el aviso.
6. [x] Comido fuera de plan (acción `comido`): desde el detalle de un plato de hoy o de días pasados, «¿Has comido otra cosa?». La IA estima kcal y macros y da una valoración; sustituye el plato solo para esa persona y reajusta las raciones del resto de su día (factor limitado a 0,5-1,8). La lista de la compra usa las raciones del plan.
7. [x] Emojis discretos en platos (en lugar de las letras D/C/N/T) y ejercicios; botón «Ver cómo se hace» con el muñeco 3D.
8. [x] Publicada en GitHub Pages: https://carlitoseh.github.io/CarSoFit/CarSofit/ (repo carlitoseh/CarSoFit, archivos dentro de la subcarpeta CarSofit/).
