// =========================================================
// CARRUSELES
// =========================================================

const carousels = ["light", "logic", "create"];

carousels.forEach(section => {

    const grid = document.querySelector(`.${section}-grid`);
    const left = document.querySelector(`.${section}-arrow-left`);
    const right = document.querySelector(`.${section}-arrow-right`);

    if (!grid || !left || !right) return;

    right.addEventListener("click", () => {
        grid.scrollBy({
            left: 390,
            behavior: "smooth"
        });
    });

    left.addEventListener("click", () => {
        grid.scrollBy({
            left: -390,
            behavior: "smooth"
        });
    });

});


// =========================================================
// ABRIR MODALES
// =========================================================

const projectButtons = document.querySelectorAll(
    ".light-ver-proyecto, .logic-ver-proyecto, .create-ver-proyecto"
);

projectButtons.forEach(button => {

    button.addEventListener("click", () => {

        const project = button.dataset.project;

        if (!project) return;

        const modal = document.getElementById(`modal-${project}`);

        if (!modal) return;

        modal.style.display = "flex";

        // Bloquear scroll de la página
        document.body.style.overflow = "hidden";

    });

});


// =========================================================
// CERRAR MODALES CON ×
// =========================================================

const closeButtons = document.querySelectorAll(".project-modal-close");

closeButtons.forEach(button => {

    button.addEventListener("click", () => {

        const modal = button.closest(".project-modal");

        if (!modal) return;

        modal.style.display = "none";

        // Recuperar scroll
        document.body.style.overflow = "";

    });

});


// =========================================================
// CERRAR AL HACER CLIC FUERA DEL CUADRO
// =========================================================

const modals = document.querySelectorAll(".project-modal");

modals.forEach(modal => {

    modal.addEventListener("click", event => {

        if (event.target === modal) {

            modal.style.display = "none";

            // Recuperar scroll
            document.body.style.overflow = "";

        }

    });

});


// =========================================================
// CERRAR CON ESCAPE
// =========================================================

document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

        modals.forEach(modal => {
            modal.style.display = "none";
        });

        // Recuperar scroll
        document.body.style.overflow = "";

    }

});

// =========================================================
// CABLES DE FONDO (LIGHT / LOGIC)  — v3
// =========================================================

(() => {

    const svg     = document.getElementById("cables-svg");
    const lightEl = document.getElementById("light-cable");
    const logicEl = document.getElementById("logic-cable");
    const lightCore = document.getElementById("light-core");
    const logicCore = document.getElementById("logic-core");
    const lightGlass = document.getElementById("light-glass");
    const logicGlass = document.getElementById("logic-glass");

    if (!svg || !lightEl || !logicEl || !lightCore || !logicCore || !lightGlass || !logicGlass) return;

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
        const start = pt(px(r.home, 0.08), py(r.home, 0.08));
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

    // ── Dibuja ────────────────────────────────────────────

    const MQ = window.matchMedia("(max-width: 1000px)");

    function draw() {
        const r = getRefs();
        if (!r.home || !r.footer) return;

        const routes = MQ.matches ? buildMobile(r) : buildDesktop(r);

        lightEl.setAttribute("d", smoothPath(routes.light));
        lightGlass.setAttribute("d", smoothPath(routes.light));
        lightCore.setAttribute("d", smoothPath(routes.light));

        logicEl.setAttribute("d", smoothPath(routes.logic));
        logicGlass.setAttribute("d", smoothPath(routes.logic));
        logicCore.setAttribute("d", smoothPath(routes.logic));

        // El SVG cubre exactamente el scrollHeight del documento.
        // NO añadimos margen extra: eso estiraría el body
        // creando espacio blanco al final.
        const docH = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
        );
        const docW = document.documentElement.clientWidth;

        svg.setAttribute("height",  docH);
        svg.setAttribute("width",   docW);
        svg.setAttribute("viewBox", `0 0 ${docW} ${docH}`);
    }

    // ── Recálculo automático ──────────────────────────────

    let timer = null;
    const redraw = () => { clearTimeout(timer); timer = setTimeout(draw, 150); };

    window.addEventListener("resize", redraw);
    window.addEventListener("load",   () => {
        draw();
        Array.from(document.images).forEach(img => {
            if (!img.complete) img.addEventListener("load", redraw);
        });
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
    if (document.readyState === "complete") draw();
    else document.addEventListener("DOMContentLoaded", draw);

})();