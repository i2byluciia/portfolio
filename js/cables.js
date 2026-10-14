// =========================================================
// CABLES DE FONDO (LIGHT / LOGIC)
// ---------------------------------------------------------
// Todo lo que ocurre en los cables vive en este módulo:
//   1) Geometría: el trazado se calcula a partir de la posición
//      real de las secciones (buildDesktop / buildMobile).
//   2) Iluminación por sección: cada sección fija un nivel
//      objetivo por cable; la transición es temporal, no
//      depende del porcentaje de scroll.
//   3) Chispas: una por cable, siempre presente, que acompaña al
//      scroll recorriendo el trazado real.
//   4) Cue final: al llegar al footer, las dos chispas viajan
//      hasta el punto de encuentro de los cables, destello y
//      blackout.
//
// Variables CSS escritas sobre #cables-svg (ver style.css):
//   --light-level / --logic-level   0..1  luminosidad del núcleo
//   --light-glow  / --logic-glow    0..1  resplandor (nivel²)
//   --blackout                      0..1  atenuación del cristal
//
// La sección activa la publica script.js con el evento
// "i2:section" (y en <html data-section>).
// =========================================================

(() => {

    const svg = document.getElementById("cables-svg");
    if (!svg) return;

    const byId = id => document.getElementById(id);

    const lightEl = byId("light-cable");
    const logicEl = byId("logic-cable");
    if (!lightEl || !logicEl) return;

    const MQ      = window.matchMedia("(max-width: 1000px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
    function randomBetween(a, b) { return a + Math.random() * (b - a); }

    const SVG_NS = "http://www.w3.org/2000/svg";

    function makePath(className) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("fill", "none");
        path.setAttribute("class", className);
        return path;
    }

    // Capas fijas del HTML que comparten el trazado de su cable
    const LAYER_SUFFIXES = ["-cable", "-glass", "-tint", "-core", "-hot"];
    const layersOf = prefix => LAYER_SUFFIXES
        .map(suffix => byId(prefix + suffix))
        .filter(Boolean);


    // ── Halo con caída gaussiana ──────────────────────────
    // En vez de pocas franjas anchas (con bordes visibles), varias
    // capas finas apiladas. La opacidad de cada una se calcula para
    // que la suma siga exp(-(r/σ)²): el resplandor se desvanece sin
    // escalones. El color va del tono claro junto al núcleo al tono
    // saturado en el borde exterior.

    const HALO_RADII = [20, 16.5, 13.5, 11, 8.5, 6.5, 4.5, 3];   // px, de fuera adentro
    const HALO_PEAK  = 0.42;                                      // opacidad junto al núcleo
    const HALO_SIGMA = 9;                                         // px: anchura de la caída
    const HALO_COLORS = {
        light: ["--golden-beam",   "--amber-glow"],     // [centro, borde]
        logic: ["--soft-lavender", "--royal-violet"]
    };
    const supportsMix = Boolean(window.CSS && CSS.supports &&
        CSS.supports("stroke", "color-mix(in srgb, red 50%, blue)"));

    function haloAlphas() {
        const goalAt = r => HALO_PEAK * Math.exp(-((r / HALO_SIGMA) ** 2));
        let covered = 0;   // opacidad acumulada por las capas más exteriores
        return HALO_RADII.map((radius, i) => {
            const inner = HALO_RADII[i + 1] || 0;
            const goal  = goalAt((radius + inner) / 2);
            // 1 - (1 - covered) · (1 - alpha) = goal
            const alpha = Math.max(0, 1 - (1 - goal) / (1 - covered));
            covered = goal;
            return alpha;
        });
    }

    function buildHalo(name) {
        const group = byId(name + "-halos");
        if (!group) return [];
        const [center, edge] = HALO_COLORS[name];
        return haloAlphas().map((alpha, i) => {
            const radius = HALO_RADII[i];
            const edgeShare = Math.round((radius / HALO_RADII[0]) * 100);
            const path = makePath("cable-halo");
            path.style.stroke = supportsMix
                ? `color-mix(in srgb, var(${edge}) ${edgeShare}%, var(${center}))`
                : `var(${edgeShare > 50 ? edge : center})`;
            path.style.strokeWidth = `calc(${radius * 2}px * var(--halo-scale, 1))`;
            path.style.opacity = `calc(${alpha.toFixed(4)} * var(--${name}-glow))`;
            group.appendChild(path);
            return path;
        });
    }

    // ── Volumen del tubo de cristal ───────────────────────
    // Copias del mismo trazado, desplazadas unos px por CSS (luz que
    // llega desde arriba a la izquierda): sombra interior en el lado
    // opuesto a la luz, y reflejos especulares sobre la superficie
    // del vidrio. Sin geometría nueva ni filtros.
    function buildTube(name) {
        const glass = byId(name + "-glass");
        const hot   = byId(name + "-hot");
        if (!glass || !hot) return [];

        const shade = makePath(`cable-shade cable-shade-${name}`);
        glass.after(shade);                    // dentro del vidrio, bajo la luz

        const soft = makePath("cable-specular cable-specular-soft");
        const main = makePath("cable-specular cable-specular-main");
        hot.after(soft, main);                 // por encima de la luz: brillo del vidrio

        return [shade, soft, main];
    }

    // Todas las capas de un cable comparten el mismo trazado
    const layers = {
        light: [...layersOf("light"), ...buildTube("light"), ...buildHalo("light")],
        logic: [...layersOf("logic"), ...buildTube("logic"), ...buildHalo("logic")]
    };


    // ── Utilidades ────────────────────────────────────────

    function docRect(el) {
        if (!el) return null;
        const r  = el.getBoundingClientRect();
        const sx = window.scrollX || window.pageXOffset;
        const sy = window.scrollY || window.pageYOffset;
        return {
            left  : r.left   + sx,
            right : r.right  + sx,
            top   : r.top    + sy,
            bottom: r.bottom + sy,
            width : r.width,
            height: r.height
        };
    }

    function px(rect, f) { return rect.left + rect.width  * f; }
    function py(rect, f) { return rect.top  + rect.height * f; }
    function pt(x, y)    { return { x, y }; }

    // Catmull-Rom → Bézier cúbica
    function smoothPath(pts) {
        if (pts.length < 2) return "";
        let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[i + 2] || p2;
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            d += `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, `
               + `${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, `
               + `${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
        }
        return d;
    }

    // ── Referencias ───────────────────────────────────────

    function getRefs() {
        const $ = id => document.getElementById(id);
        return {
            logo   : docRect(document.querySelector(".logo")),
            home   : docRect($("home")),
            about  : docRect($("about")),
            light  : docRect($("light")),
            ltitle : docRect($("light") && $("light").querySelector("h2")),
            logic  : docRect($("logic")),
            gtitle : docRect($("logic") && $("logic").querySelector("h2")),
            create : docRect($("create")),
            ctitle : docRect($("create") && $("create").querySelector("h2")),
            contact: docRect($("contact")),
            footer : docRect(document.querySelector("footer"))
        };
    }

    // ── Escritorio > 1000 px ──────────────────────────────

    function buildDesktop(r) {

        // Punto de inicio: debajo del logo i²
        const startX = px(r.home, 0.04);
        const startY = py(r.home, 0.06);

        // Punto final: dentro del footer, bien visible.
        const endX = px(r.footer, 0.88);
        const endY = r.footer.top + r.footer.height * 0.65;


        // ─────────────────────────────────────────────────
        // LIGHT (ámbar)
        // ─────────────────────────────────────────────────

        const light = [];

        // HOME: arranca arriba-izquierda, gran arco hacia la
        // derecha (por debajo del nav), vuelve hacia la
        // izquierda antes de bajar a About.
        // El boceto (img 3) muestra la ola pegada al borde
        // superior, no desplazada al centro.
        light.push(pt(startX, startY));
        light.push(pt(px(r.home, 0.30), py(r.home, 0.55)));
        light.push(pt(px(r.home, 0.72), py(r.home, 0.43)));
        light.push(pt(px(r.home, 0.90), py(r.home, 0.85)));
        light.push(pt(px(r.home, 0.24), py(r.home, 0.96)));

        // ABOUT: curva amplia hacia la derecha y vuelve.
        light.push(pt(px(r.about, 0.15), py(r.about, 0.16)));
        light.push(pt(px(r.about, 0.55), py(r.about, 0.30)));
        light.push(pt(px(r.about, 0.90), py(r.about, 0.55)));
        light.push(pt(px(r.about, 0.22), py(r.about, 0.90)));

        // LIGHT (sección): tres olas amplias horizontales.
        // Entra por la izquierda junto al título.
        if (r.ltitle) {
            light.push(pt(r.ltitle.left - 20, r.ltitle.top + r.ltitle.height * 0.5));
        }
        light.push(pt(px(r.light, 0.55), py(r.light, 0.12)));
        light.push(pt(px(r.light, 0.92), py(r.light, 0.28)));
        light.push(pt(px(r.light, 0.55), py(r.light, 0.42)));
        light.push(pt(px(r.light, 0.10), py(r.light, 0.56)));
        light.push(pt(px(r.light, 0.60), py(r.light, 0.72)));
        light.push(pt(px(r.light, 0.12), py(r.light, 0.86)));
        light.push(pt(px(r.light, 0.45), py(r.light, 0.97)));

        // LOGIC (sección): LIGHT serpentea por la izquierda.
        // Entra por la izquierda, hace curvas en S pero
        // sin cruzar el centro de la sección.
        light.push(pt(px(r.logic, 0.08), py(r.logic, 0.06)));
        light.push(pt(px(r.logic, 0.30), py(r.logic, 0.25)));
        light.push(pt(px(r.logic, 0.94), py(r.logic, 0.46)));
        light.push(pt(px(r.logic, 0.40), py(r.logic, 0.68)));
        light.push(pt(px(r.logic, 0.10), py(r.logic, 0.95)));
        light.push(pt(px(r.logic, 0.80), py(r.logic, 0.85)));

        // CREATE: primer cruce exactamente en el centro del
        // título "Create". Los dos cables pasan por el mismo
        // punto Y del título cruzándose de lado a lado.
        const cty = r.ctitle
            ? r.ctitle.top + r.ctitle.height * 0.55
            : py(r.create, 0.12);
        const ctx = r.ctitle
            ? r.ctitle.left + r.ctitle.width  * 0.5
            : px(r.create, 0.50);

        // LIGHT: viene de logic (derecha), baja hacia el título
        // cruzándose con LOGIC exactamente ahí, luego sigue.
        light.push(pt(px(r.create, 0.90), r.create.top + (cty - r.create.top) * 0.3));
        light.push(pt(ctx, cty));                              // ← CRUCE en el título
        light.push(pt(px(r.create, 0.10), py(r.create, 0.40)));
        light.push(pt(px(r.create, 0.35), py(r.create, 0.60)));
        light.push(pt(px(r.create, 0.65), py(r.create, 0.72)));
        light.push(pt(px(r.create, 0.12), py(r.create, 0.96)));

        // CONTACT: curvas amplias, poca presencia izquierda.
        light.push(pt(px(r.contact, 0.06), py(r.contact, 0.10)));
        light.push(pt(px(r.contact, 0.65), py(r.contact, 0.45)));
        light.push(pt(px(r.contact, 0.10), py(r.contact, 0.90)));

        // FOOTER
        light.push(pt(px(r.footer, 0.35), py(r.footer, 0.35)));
        light.push(pt(endX, endY));


        // ─────────────────────────────────────────────────
        // LOGIC (lavanda/violeta)
        // ─────────────────────────────────────────────────

        const logic = [];

        // HOME: sale del mismo punto, pero se va más
        // a la derecha pasando por encima del título.
        logic.push(pt(startX, startY));
        logic.push(pt(px(r.home, 0.36), py(r.home, 0.18)));
        logic.push(pt(px(r.home, 0.50), py(r.home, 0.68)));
        logic.push(pt(px(r.home, 0.82), py(r.home, 0.20)));

        // ABOUT: ese independiente del recorrido de LIGHT.
        logic.push(pt(px(r.about, 0.65), py(r.about, 0.08)));
        logic.push(pt(px(r.about, 0.88), py(r.about, 0.30)));
        logic.push(pt(px(r.about, 0.10), py(r.about, 0.52)));
        logic.push(pt(px(r.about, 0.68), py(r.about, 0.74)));
        logic.push(pt(px(r.about, 0.48), py(r.about, 0.96)));

        // LIGHT (sección): LOGIC pasa por la derecha,
        // NO toca el título (que está a la izquierda).
        logic.push(pt(px(r.light, 0.82), py(r.light, 0.08)));
        logic.push(pt(px(r.light, 0.48), py(r.light, 0.28)));
        logic.push(pt(px(r.light, 0.88), py(r.light, 0.50)));
        logic.push(pt(px(r.light, 0.25), py(r.light, 0.75)));
        logic.push(pt(px(r.light, 0.65), py(r.light, 0.86)));
        logic.push(pt(px(r.light, 0.35), py(r.light, 0.99)));

        // LOGIC (sección): el cable atraviesa el título.
        // Tres puntos muy próximos al título fuerzan al spline
        // a pasar exactamente por él.
        if (r.gtitle) {
            // llega desde arriba-derecha hacia el extremo derecho del título
            logic.push(pt(r.gtitle.right + 30, r.gtitle.top - 18));
            // pasa por el centro del título
            logic.push(pt(r.gtitle.left + r.gtitle.width * 0.55, r.gtitle.top + r.gtitle.height * 0.5));
            // sale por debajo-izquierda del título
            logic.push(pt(r.gtitle.left + r.gtitle.width * 0.15, r.gtitle.bottom + 14));
        }
        logic.push(pt(px(r.logic, 0.80), py(r.logic, 0.22)));
        logic.push(pt(px(r.logic, 0.48), py(r.logic, 0.40)));
        logic.push(pt(px(r.logic, 0.65), py(r.logic, 0.58)));
        logic.push(pt(px(r.logic, 0.18), py(r.logic, 0.76)));
        logic.push(pt(px(r.logic, 0.30), py(r.logic, 0.92)));

        // CREATE: LOGIC entra por la izquierda y se cruza con
        // LIGHT exactamente en el título (mismo punto ctx/cty).
        logic.push(pt(px(r.create, 0.10), r.create.top + (cty - r.create.top) * 0.3));
        logic.push(pt(ctx, cty));                              // ← CRUCE en el título
        logic.push(pt(px(r.create, 0.90), py(r.create, 0.40)));
        logic.push(pt(px(r.create, 0.65), py(r.create, 0.60)));
        logic.push(pt(px(r.create, 0.35), py(r.create, 0.72)));
        logic.push(pt(px(r.create, 0.92), py(r.create, 0.92)));

        // CONTACT: gran lazo en lágrima a la derecha
        logic.push(pt(px(r.contact, 0.92), py(r.contact, 0.10)));
        logic.push(pt(px(r.contact, 0.40), py(r.contact, 0.40)));
        logic.push(pt(px(r.contact, 0.90), py(r.contact, 0.90)));

        // FOOTER
        logic.push(pt(endX, endY));

        return { light, logic };
    }

    // ── Móvil ≤ 1000 px ───────────────────────────────────

    function buildMobile(r) {
        // Inicio: dentro del círculo del logo i² (abajo a la derecha),
        // para que los cables nazcan "enchufados" a él como en
        // escritorio. El logo es fijo: se usa su posición en pantalla
        // sin sumar el scroll (con scroll 0 coincide con el documento).
        const logoEl = document.querySelector(".logo");
        const lr     = logoEl ? logoEl.getBoundingClientRect() : null;
        const start  = lr && lr.width
            ? pt(lr.left + lr.width * 0.7, lr.top + lr.height * 0.75)
            : pt(px(r.home, 0.08), py(r.home, 0.08));
        const end   = pt(px(r.footer, 0.82), py(r.footer, 0.78));

        const secs  = [r.home, r.about, r.light, r.logic, r.create, r.contact];
        const light = [start];
        const logic = [start];

        secs.forEach((sec) => {
            if (!sec) return;
            light.push(pt(px(sec, 0.15), py(sec, 0.35)));
            light.push(pt(px(sec, 0.60), py(sec, 0.72)));
            logic.push(pt(px(sec, 0.72), py(sec, 0.30)));
            logic.push(pt(px(sec, 0.28), py(sec, 0.70)));
        });

        light.push(end);
        logic.push(end);
        return { light, logic };
    }


    // ── Dibujo + muestreo del trazado ─────────────────────
    // Las chispas no llaman a getPointAtLength() en cada frame:
    // cada vez que se dibuja el cable se guarda una tabla de
    // puntos cada SAMPLE_STEP px y luego se interpola sobre ella.
    //
    // La tabla se calcula evaluando directamente las curvas Bézier
    // del atributo d (las mismas que dibuja el navegador): pedir
    // miles de puntos con getPointAtLength() en un trazado tan largo
    // bloqueaba la carga ~0,5 s. Solo se pide al navegador la
    // longitud total, para que coincida al píxel con la de la estela.

    const SAMPLE_STEP = 12;
    const BEZIER_SUBDIVISIONS = 48;   // tramos rectos por curva antes de remuestrear
    const tracks = { light: null, logic: null };
    const mainEl = document.querySelector("main");
    const flash  = byId("cables-flash");
    const socket    = byId("cables-socket");      // toma de inicio
    const connector = byId("cables-connector");   // conector XLR del footer

    // Polilínea fina [x0, y0, x1, y1, …] a partir de "M x y C … C …".
    // Devuelve null si el trazado no tiene ese formato.
    function flattenPath(d) {
        const n = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
        if (!/^\s*M/i.test(d) || n.length < 8 || (n.length - 2) % 6 !== 0) return null;

        const poly = [n[0], n[1]];
        for (let i = 2; i < n.length; i += 6) {
            const x0 = poly[poly.length - 2], y0 = poly[poly.length - 1];
            const x1 = n[i],     y1 = n[i + 1];
            const x2 = n[i + 2], y2 = n[i + 3];
            const x3 = n[i + 4], y3 = n[i + 5];
            for (let s = 1; s <= BEZIER_SUBDIVISIONS; s++) {
                const t = s / BEZIER_SUBDIVISIONS, mt = 1 - t;
                const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, e = t * t * t;
                poly.push(a * x0 + b * x1 + c * x2 + e * x3,
                          a * y0 + b * y1 + c * y2 + e * y3);
            }
        }
        return poly;
    }

    function sample(path) {
        const length = path.getTotalLength();
        const count  = Math.max(2, Math.ceil(length / SAMPLE_STEP) + 1);
        const step   = length / (count - 1);
        const pts    = new Float32Array(count * 2);
        const yMax   = new Float32Array(count);   // altura máxima alcanzada hasta cada muestra

        const poly = flattenPath(path.getAttribute("d") || "");

        if (poly) {
            // Longitudes acumuladas de la polilínea, escaladas a la
            // longitud que mide el navegador
            const segs = poly.length / 2 - 1;
            const cum = new Float64Array(segs + 1);
            for (let k = 1; k <= segs; k++) {
                cum[k] = cum[k - 1] + Math.hypot(poly[k * 2] - poly[k * 2 - 2], poly[k * 2 + 1] - poly[k * 2 - 1]);
            }
            const scale = cum[segs] > 0 ? length / cum[segs] : 1;

            // Remuestreo uniforme cada `step` px recorriendo la polilínea
            let k = 1;
            for (let i = 0; i < count; i++) {
                const target = (i * step) / scale;
                while (k < segs && cum[k] < target) k++;
                const span = cum[k] - cum[k - 1];
                const t = span > 0 ? clamp((target - cum[k - 1]) / span, 0, 1) : 0;
                const x = poly[k * 2 - 2] + (poly[k * 2]     - poly[k * 2 - 2]) * t;
                const y = poly[k * 2 - 1] + (poly[k * 2 + 1] - poly[k * 2 - 1]) * t;
                pts[i * 2]     = x;
                pts[i * 2 + 1] = y;
                yMax[i] = i ? Math.max(yMax[i - 1], y) : y;
            }
        } else {
            // Respaldo: el navegador calcula cada punto (más lento)
            for (let i = 0; i < count; i++) {
                const p = path.getPointAtLength(i * step);
                pts[i * 2]     = p.x;
                pts[i * 2 + 1] = p.y;
                yMax[i] = i ? Math.max(yMax[i - 1], p.y) : p.y;
            }
        }

        return { pts, yMax, count, step, length };
    }

    function pointAt(track, dist) {
        const f = clamp(dist / track.step, 0, track.count - 1);
        const i = Math.min(Math.floor(f), track.count - 2);
        const t = f - i;
        const p = track.pts;
        return [
            p[i * 2]     + (p[i * 2 + 2] - p[i * 2])     * t,
            p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * t
        ];
    }

    function draw() {
        const r = getRefs();
        if (!r.home || !r.footer) return;

        const routes = MQ.matches ? buildMobile(r) : buildDesktop(r);

        const lightD = smoothPath(routes.light);
        const logicD = smoothPath(routes.logic);

        layers.light.forEach(el => el.setAttribute("d", lightD));
        layers.logic.forEach(el => el.setAttribute("d", logicD));

        // El SVG cubre exactamente el contenido (hasta el final de
        // <main>, que incluye el footer). Se mide <main> y no el
        // scrollHeight del documento: el propio SVG forma parte del
        // scrollHeight y nunca podría encoger al ensanchar la ventana.
        const docH = Math.ceil(docRect(mainEl || document.body).bottom);
        const docW = document.documentElement.clientWidth;

        svg.setAttribute("height",  docH);
        svg.setAttribute("width",   docW);
        svg.setAttribute("viewBox", `0 0 ${docW} ${docH}`);

        tracks.light = sample(lightEl);
        tracks.logic = sample(logicEl);

        // Punto de encuentro: los dos recorridos terminan en el
        // mismo punto del footer; ahí nace el destello final.
        const end = routes.light[routes.light.length - 1];
        const at  = p => `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`;
        if (flash)     flash.setAttribute("transform", at(end));
        if (connector) connector.setAttribute("transform", at(end));

        // Toma de inicio: los dos cables nacen en el mismo punto,
        // bajo el logo i² (en escritorio, dentro de su círculo)
        if (socket) socket.setAttribute("transform", at(routes.light[0]));

        // Las chispas se recolocan sobre el trazado nuevo
        resetSparks();
        wake();
    }


    // ── Iluminación por sección ───────────────────────────

    const OFF = 0;      // apagado: sin luz de color
    const DIM = 0.32;   // "tenue"
    const RES = 0.35;   // residual de Contact, antes del cierre
    const ON  = 1;      // máximo

    // Nivel objetivo [light, logic] por sección.
    // El footer no aparece aquí: lo gobierna el cue final.
    const LEVELS = {
        home   : [DIM, DIM],
        about  : [DIM, DIM],
        light  : [ON,  OFF],
        logic  : [OFF, ON ],
        create : [ON,  ON ],
        contact: [RES, RES]
    };

    // Constantes de tiempo (s) de la transición exponencial
    const TAU         = 0.28;   // cambio normal entre secciones
    const TAU_CONTACT = 0.9;    // descenso progresivo al entrar en Contact
    const TAU_CUE     = 0.3;    // subida mientras viaja la última señal
    const TAU_OFF     = 0.5;    // apagado final tras el destello

    const level  = [DIM, DIM];
    const target = [DIM, DIM];
    let blackout       = 0;
    let blackoutTarget = 0;
    let tau            = TAU;
    let section        = document.documentElement.dataset.section || "home";

    const written = {};

    function setVar(name, value) {
        const v = value.toFixed(3);
        if (written[name] === v) return;
        written[name] = v;
        svg.style.setProperty(name, v);
    }

    function render() {
        setVar("--light-level", level[0]);
        setVar("--logic-level", level[1]);
        setVar("--light-glow",  level[0] * level[0]);   // el halo cae más rápido que el núcleo
        setVar("--logic-glow",  level[1] * level[1]);
        setVar("--blackout",    blackout);
    }

    function approach(current, goal, k) {
        const diff = goal - current;
        return Math.abs(diff) < 0.002 ? goal : current + diff * k;
    }


    // ── Bucle de animación ────────────────────────────────
    // Un único requestAnimationFrame para luces, chispas y cue.
    // Solo corre mientras algo se está moviendo.

    let rafId = 0;
    let lastTime = 0;

    function wake() {
        if (rafId) return;
        lastTime = performance.now();
        rafId = requestAnimationFrame(frame);
    }

    function frame(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        const k = 1 - Math.exp(-dt / tau);

        level[0] = approach(level[0], target[0], k);
        level[1] = approach(level[1], target[1], k);
        blackout = approach(blackout, blackoutTarget, k);

        const sparksBusy = updateSparks(dt);

        render();

        const settled = level[0] === target[0]
            && level[1] === target[1]
            && blackout === blackoutTarget;

        rafId = (settled && !sparksBusy) ? 0 : requestAnimationFrame(frame);
    }

    function applySection(snap) {
        const lv = LEVELS[section] || LEVELS.home;
        target[0] = lv[0];
        target[1] = lv[1];
        blackoutTarget = 0;
        tau = section === "contact" ? TAU_CONTACT : TAU;

        if (snap) {
            level[0] = target[0];
            level[1] = target[1];
            blackout = blackoutTarget;
            render();
        }
        wake();
    }


    // ── Chispas que acompañan al scroll ───────────────────
    // Cada cable lleva una chispa permanente, situada en el punto de
    // su trazado que cruza la línea central de la pantalla. Al hacer
    // scroll la chispa recorre el cable real (hacia delante al bajar,
    // hacia atrás al subir) con una estela proporcional a la
    // velocidad; parada, solo "respira" (animación CSS de la cabeza).
    // Su brillo sigue al nivel del cable: tenue en Home/About, intensa
    // en su sección e invisible si el cable está apagado.
    //
    // La estela usa el MISMO trazado que el cable, recortado con
    // stroke-dasharray: sigue exactamente las curvas sin dibujar
    // geometría nueva. La cabeza es la chispa del HTML.

    const READ_LINE  = 0.5;    // fracción de la pantalla que sigue la chispa
    const TAU_SPARK  = 0.08;   // s: suavizado del recorrido con el scroll
    const TAU_TRAIL  = 0.15;   // s: suavizado de la longitud de la estela
    const TRAIL_GAIN = 0.12;   // px de estela por cada px/s de velocidad
    const TRAIL_MIN  = 40;     // px: estela corta también en reposo
    const TRAIL_MAX  = 260;    // px

    // Capas de la estela: [clase, fracción de la longitud actual].
    // Como un cometa: la cola es larga, fina y tenue; cerca de la
    // cabeza se suman más capas y el pulso gana brillo.
    const TRAIL = [
        ["pulse-tail", 1   ],
        ["pulse-body", 0.6 ],
        ["pulse-glow", 0.28],
        ["pulse-core", 0.3 ],
        ["pulse-head", 0.1 ]
    ];

    const sparks = {};

    ["light", "logic"].forEach((name, index) => {
        const head = byId(name + "-spark");
        if (!head) return;
        head.removeAttribute("id");
        head.removeAttribute("visibility");                  // la hereda del grupo
        const body = head.querySelector(".spark-body");
        if (body) body.removeAttribute("opacity");          // la lleva la animación CSS

        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("class", `cable-pulse cable-pulse-${name}`);
        group.setAttribute("visibility", "hidden");
        group.setAttribute("opacity", "0");

        const trail = TRAIL.map(([className, share]) => {
            const path = makePath(className);
            path.style.visibility = "hidden";
            group.appendChild(path);
            layers[name].push(path);    // recibe el trazado en draw()
            return { path, share };
        });

        group.appendChild(head);
        svg.insertBefore(group, flash);

        sparks[name] = {
            name, index, group, head, trail,
            pos: 0,          // distancia actual sobre el trazado
            trailLen: 0,
            dir: 1,          // 1 = avanza (bajando), -1 = retrocede
            ready: false,    // la primera vez se coloca sin animación
            cueSpeed: 0,
            shown: ""
        };
    });

    // ── Chispitas que deja la chispa ──────────────────────
    // Pequeñas estrellas de 4 puntas que se desprenden de la cabeza y
    // se quedan atrás: se separan un poco del cable, caen levemente
    // (como las chispas reales), giran, encogen y se apagan. Salen
    // más cuanto más rápido es el scroll; en reposo, alguna de vez en
    // cuando. Se reutilizan siempre los mismos elementos.

    const SPARKLE_PATH   = "M0.0 -3.4 Q0.4 -0.4 3.4 -0.0 Q0.4 0.4 0.0 3.4 Q-0.4 0.4 -3.4 0.0 Q-0.4 -0.4 0.0 -3.4 Z";
    const SPARKLE_POOL   = 36;            // por cable
    const SPARKLE_STEP   = 14;            // px de recorrido entre chispitas
    const SPARKLE_BURST  = 4;             // máximo por frame
    const SPARKLE_REST   = [0.35, 0.8];   // s entre chispitas en reposo
    const SPARKLE_FALL   = 40;            // px/s²: caída leve

    const firstPulse = sparks.light ? sparks.light.group : flash;
    const sparkleLayer = document.createElementNS(SVG_NS, "g");
    sparkleLayer.setAttribute("class", "cable-sparkles");
    svg.insertBefore(sparkleLayer, firstPulse);   // por detrás de las cabezas

    Object.values(sparks).forEach(spark => {
        spark.emitAcc = 0;
        spark.restIn  = SPARKLE_REST[0];
        spark.sparkles = Array.from({ length: SPARKLE_POOL }, () => {
            const el = document.createElementNS(SVG_NS, "path");
            el.setAttribute("d", SPARKLE_PATH);
            el.setAttribute("class", `cable-sparkle cable-sparkle-${spark.name}`);
            el.setAttribute("visibility", "hidden");
            sparkleLayer.appendChild(el);
            return { el, alive: false };
        });
    });

    function emitSparkle(spark, track, dist, brightness) {
        const p = spark.sparkles.find(s => !s.alive);
        if (!p) return;
        const [x, y] = pointAt(track, dist);
        const angle = Math.random() * Math.PI * 2;
        const speed = randomBetween(10, 38);
        p.alive = true;
        p.age   = 0;
        p.life  = randomBetween(0.45, 0.95);
        p.x     = x + randomBetween(-3, 3);
        p.y     = y + randomBetween(-3, 3);
        p.vx    = Math.cos(angle) * speed;
        p.vy    = Math.sin(angle) * speed - 8;
        p.size  = randomBetween(0.9, 1.7);
        p.rot   = Math.random() * 90;
        p.spin  = randomBetween(-180, 180);
        p.peak  = brightness * randomBetween(0.7, 1);
        p.el.classList.toggle("is-hot", Math.random() < 0.35);
        p.el.setAttribute("visibility", "visible");
    }

    // Devuelve true mientras quede alguna chispita viva
    function updateSparkles(spark, dt) {
        let alive = false;
        spark.sparkles.forEach(p => {
            if (!p.alive) return;
            p.age += dt;
            const t = p.age / p.life;
            if (t >= 1) {
                p.alive = false;
                p.el.setAttribute("visibility", "hidden");
                return;
            }
            alive = true;
            p.vy  += SPARKLE_FALL * dt;
            p.x   += p.vx * dt;
            p.y   += p.vy * dt;
            p.rot += p.spin * dt;
            const scale   = p.size * (1 - 0.6 * t);
            const twinkle = 0.75 + 0.25 * Math.sin(p.age * 38);
            p.el.setAttribute("transform",
                `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)}) scale(${scale.toFixed(2)})`);
            p.el.setAttribute("opacity", (p.peak * (1 - t) ** 1.3 * twinkle).toFixed(3));
        });
        return alive;
    }

    // Suelta chispitas según el recorrido del frame y, en reposo, de
    // vez en cuando. Devuelve true si la chispa está "viva" (emite).
    function sparkleFrom(spark, track, moved, brightness, dt) {
        if (reduced.matches || document.hidden || brightness < 0.05) {
            spark.emitAcc = 0;
            return false;
        }

        if (moved !== 0) {
            spark.emitAcc += Math.abs(moved);
            let n = 0;
            while (spark.emitAcc >= SPARKLE_STEP && n < SPARKLE_BURST) {
                spark.emitAcc -= SPARKLE_STEP;
                // Repartidas a lo largo del tramo recorrido en este frame
                emitSparkle(spark, track, spark.pos - spark.emitAcc * Math.sign(moved), brightness);
                n++;
            }
            if (n === SPARKLE_BURST) spark.emitAcc = 0;
        }

        spark.restIn -= dt;
        if (spark.restIn <= 0) {
            emitSparkle(spark, track, spark.pos, brightness * 0.8);
            spark.restIn = randomBetween(SPARKLE_REST[0], SPARKLE_REST[1]);
        }
        return true;
    }

    // Distancia sobre el trazado para una altura del documento.
    // yMax guarda la altura máxima alcanzada hasta cada muestra
    // (monótona): la chispa siempre avanza al bajar, aunque el cable
    // haga algún bucle hacia arriba (lo recorre en lugar de saltarlo).
    function distanceForY(track, y) {
        const m = track.yMax;
        const last = track.count - 1;
        if (y <= m[0]) return 0;
        if (y >= m[last]) return track.length;
        let lo = 0, hi = last;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (m[mid] < y) lo = mid;
            else hi = mid;
        }
        const t = (y - m[lo]) / Math.max(m[hi] - m[lo], 1e-6);
        return (lo + t) * track.step;
    }

    function sparkGoal(spark, track) {
        if (cue.phase !== "idle") return track.length;   // cue final: al punto de encuentro
        return distanceForY(track, window.scrollY + window.innerHeight * READ_LINE);
    }

    // Brillo de la chispa según el nivel de su cable
    function sparkBrightness(spark) {
        if (cue.phase === "travel") return 1;
        return level[spark.index] ** 0.75;   // 0.32 (tenue) → 0.43
    }

    function drawSpark(spark, track, brightness) {
        const opacity = brightness.toFixed(3);
        if (spark.shown !== opacity) {
            spark.shown = opacity;
            spark.group.setAttribute("opacity", opacity);
            spark.group.setAttribute("visibility", brightness > 0.01 ? "visible" : "hidden");
        }
        if (brightness <= 0.01) return;

        const [x, y] = pointAt(track, spark.pos);
        spark.head.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);

        spark.trail.forEach(({ path, share }) => {
            const len = spark.trailLen * share;
            if (len < 1) {
                path.style.visibility = "hidden";
                return;
            }
            // La estela queda detrás de la chispa según su sentido
            const from = spark.dir > 0 ? Math.max(0, spark.pos - len) : spark.pos;
            const to   = spark.dir > 0 ? spark.pos : Math.min(track.length, spark.pos + len);
            // Un solo tramo visible [from, to]; el hueco es más largo
            // que el cable para que el patrón no se repita.
            path.style.visibility       = "visible";
            path.style.strokeDasharray  = `${(to - from).toFixed(1)} ${(track.length + TRAIL_MAX).toFixed(1)}`;
            path.style.strokeDashoffset = (-from).toFixed(1);
        });
    }

    // Avanza las chispas un frame (dt en s). Devuelve true mientras
    // alguna siga moviéndose o su estela no se haya recogido.
    function updateSparks(dt) {
        let busy = false;

        Object.values(sparks).forEach(spark => {
            const track = tracks[spark.name];
            if (!track) return;

            const goal = sparkGoal(spark, track);
            const brightness = sparkBrightness(spark);
            const instant = !spark.ready || reduced.matches || brightness < 0.02;
            const previous = spark.pos;

            if (instant) {
                spark.pos = goal;
            } else if (cue.phase === "travel") {
                // Velocidad constante: las dos chispas llegan a la vez
                spark.pos = Math.min(goal, spark.pos + spark.cueSpeed * dt);
            } else {
                spark.pos = approach(spark.pos, goal, 1 - Math.exp(-dt / TAU_SPARK));
                if (Math.abs(goal - spark.pos) < 0.5) spark.pos = goal;
            }
            spark.ready = true;

            const velocity = dt > 0 ? (spark.pos - previous) / dt : 0;
            if (Math.abs(velocity) > 5) spark.dir = Math.sign(velocity);

            const wanted = instant
                ? TRAIL_MIN
                : clamp(Math.abs(velocity) * TRAIL_GAIN, TRAIL_MIN, TRAIL_MAX);
            if (instant) spark.trailLen = wanted;
            else spark.trailLen += (wanted - spark.trailLen) * (1 - Math.exp(-dt / TAU_TRAIL));
            if (Math.abs(spark.trailLen - wanted) < 0.5) spark.trailLen = wanted;

            drawSpark(spark, track, brightness);

            const moved  = instant ? 0 : spark.pos - previous;
            const living = sparkleFrom(spark, track, moved, brightness, dt);
            const falling = updateSparkles(spark, dt);

            if (spark.pos !== goal || spark.trailLen !== wanted || living || falling) busy = true;
        });

        // Cue final: las dos chispas han llegado al punto de encuentro
        if (cue.phase === "travel" && Object.values(sparks).every(s =>
            tracks[s.name] && s.pos >= tracks[s.name].length - 0.5)) {
            goDark(true);
        }

        return busy;
    }

    // Tras redibujar el trazado, las chispas se recolocan sin animación
    function resetSparks() {
        Object.values(sparks).forEach(spark => { spark.ready = false; });
    }


    // ── Cue final: encuentro, destello y blackout ─────────
    // Fases: idle → travel (las dos chispas viajan a velocidad
    // constante hasta el punto de encuentro y llegan a la vez) →
    // dark (destello + apagado). Al salir del footer se vuelve a idle,
    // se recupera el estado de Contact y las chispas regresan.

    const CUE_TRAVEL = 0.9;   // s que tarda la última señal en llegar

    const cue = { phase: "idle" };

    function startCue() {
        if (cue.phase !== "idle") return;

        if (reduced.matches || !tracks.light || !tracks.logic) {
            goDark(false);
            return;
        }

        cue.phase = "travel";
        target[0] = target[1] = 0.6;
        tau = TAU_CUE;

        Object.values(sparks).forEach(spark => {
            const remaining = tracks[spark.name].length - spark.pos;
            spark.cueSpeed = Math.max(200, remaining / CUE_TRAVEL);
        });

        wake();
    }

    function goDark(withFlash) {
        cue.phase = "dark";
        target[0] = target[1] = 0;
        blackoutTarget = 1;
        tau = TAU_OFF;
        if (withFlash && flash) {
            flash.classList.remove("is-flashing");
            void flash.getBoundingClientRect();   // reinicia la animación CSS
            flash.classList.add("is-flashing");
        }
        wake();
    }

    function endCue() {
        if (cue.phase === "idle") return;
        cue.phase = "idle";
        if (flash) flash.classList.remove("is-flashing");
        applySection(false);
    }


    // ── Eventos ───────────────────────────────────────────

    // Sección activa (la publica script.js). La primera se aplica
    // sin transición para que la carga no tenga parpadeos.
    let first = true;
    document.addEventListener("i2:section", event => {
        section = event.detail.id;
        if (cue.phase !== "idle") return;   // el cue manda mientras el footer está a la vista
        applySection(first);
        first = false;
    });

    // Footer: el cue arranca cuando se ve buena parte del footer y
    // se rearma solo cuando el footer sale por completo de la
    // pantalla (histéresis: no hay parpadeos en el borde).
    const footerEl = document.querySelector("footer");
    if (footerEl && "IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            const entry = entries[entries.length - 1];
            if (entry.intersectionRatio >= 0.6) startCue();
            else if (!entry.isIntersecting) endCue();
        }, { threshold: [0, 0.6] }).observe(footerEl);
    }

    // Recalcular el trazado cuando cambia el contenido (ventana,
    // imágenes diferidas, fuentes): un ResizeObserver sobre <main>
    // cubre todos los casos sin escuchar cada recurso por separado.
    let redrawTimer = 0;
    const redraw = () => {
        clearTimeout(redrawTimer);
        redrawTimer = setTimeout(draw, 150);
    };

    if (typeof ResizeObserver === "function" && mainEl) {
        new ResizeObserver(redraw).observe(mainEl);
    } else {
        window.addEventListener("resize", redraw);
        window.addEventListener("load", redraw);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
    MQ.addEventListener("change", redraw);

    // Las chispas siguen al scroll: solo se despierta el bucle, que
    // lee la posición una vez por frame y se detiene al asentarse.
    window.addEventListener("scroll", wake, { passive: true });
    reduced.addEventListener("change", wake);
    document.addEventListener("visibilitychange", wake);   // reanuda las chispitas

    // Estado correcto desde el primer frame
    draw();
    applySection(true);

})();
