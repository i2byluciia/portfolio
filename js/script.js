// =========================================================
// INTERFAZ: lupa, carruseles, modales, sección activa y tema
// (los cables viven en js/cables.js)
// =========================================================


// =========================================================
// EFECTO LUPA EN EL TÍTULO (Light · Logic · Create)
// =========================================================

(function () {

    const title = document.querySelector("#home h1");
    if (!title) return;

    // Con movimiento reducido el título se deja intacto
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Envolvemos cada letra en un <span> para poder escalarla
    // individualmente. Los espacios se dejan como texto normal
    // para no romper el flujo del título.
    const text = title.textContent.trim();
    title.textContent = "";

    // Los lectores de pantalla leen el título completo, no letra a letra
    title.setAttribute("aria-label", text);

    text.split("").forEach(char => {
        if (char === " ") {
            title.appendChild(document.createTextNode(" "));
        } else {
            const span = document.createElement("span");
            span.textContent = char;
            span.setAttribute("aria-hidden", "true");
            title.appendChild(span);
        }
    });

    const letters = title.querySelectorAll("span");

    const MAX_SCALE = 1.6;   // cuánto se amplía la letra bajo el cursor
    const RADIUS = 70;       // px de radio de influencia de la "lupa"

    const applyMagnify = (mouseX, mouseY) => {
        letters.forEach(letter => {
            const rect = letter.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const distance = Math.hypot(mouseX - centerX, mouseY - centerY);

            if (distance < RADIUS) {
                const scale = MAX_SCALE - (distance / RADIUS) * (MAX_SCALE - 1);
                letter.style.transform = `scale(${scale})`;
            } else {
                letter.style.transform = "scale(1)";
            }
        });
    };

    title.addEventListener("mousemove", (e) => {
        applyMagnify(e.clientX, e.clientY);
    });

    title.addEventListener("mouseleave", () => {
        letters.forEach(letter => {
            letter.style.transform = "scale(1)";
        });
    });

})();


// =========================================================
// CARRUSELES
// =========================================================

["light", "logic", "create"].forEach(section => {

    const grid = document.querySelector(`.${section}-grid`);
    const left = document.querySelector(`.${section}-arrow-left`);
    const right = document.querySelector(`.${section}-arrow-right`);

    if (!grid || !left || !right) return;

    // Calcula cuánto hay que desplazar (ancho real de una tarjeta + gap),
    // así funciona bien tanto en escritorio como en móvil.
    const getStep = () => {
        const card = grid.querySelector(`.${section}-card`);
        if (!card) return 390;
        const gap = parseFloat(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap) || 0;
        return card.getBoundingClientRect().width + gap;
    };

    // Marca las flechas en los extremos (aria-disabled y no disabled:
    // así el botón conserva el foco del teclado al llegar al final)
    const updateEdges = () => {
        const maxScroll = grid.scrollWidth - grid.clientWidth;
        left.setAttribute("aria-disabled", String(grid.scrollLeft <= 2));
        right.setAttribute("aria-disabled", String(grid.scrollLeft >= maxScroll - 2));
    };

    right.addEventListener("click", () => {
        if (right.getAttribute("aria-disabled") === "true") return;
        grid.scrollBy({
            left: getStep(),
            behavior: "smooth"
        });
    });

    left.addEventListener("click", () => {
        if (left.getAttribute("aria-disabled") === "true") return;
        grid.scrollBy({
            left: -getStep(),
            behavior: "smooth"
        });
    });

    grid.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    updateEdges();

});


// =========================================================
// MODALES DE PROYECTOS (<dialog> nativo)
// ---------------------------------------------------------
// showModal() ya resuelve: foco dentro del modal, Escape para
// cerrar y bloqueo del contenido de detrás. Aquí solo se abre
// desde "Ver proyecto", se cierra con × o clic fuera, y se
// devuelve el foco al botón que lo abrió.
// =========================================================

(() => {

    let opener = null;

    document.querySelectorAll(
        ".light-ver-proyecto, .logic-ver-proyecto, .create-ver-proyecto"
    ).forEach(button => {

        button.addEventListener("click", () => {
            const project = button.dataset.project;
            const modal = project && document.getElementById(`modal-${project}`);

            if (!modal || typeof modal.showModal !== "function") return;

            opener = button;
            modal.showModal();

            // Bloquear scroll de la página
            document.body.style.overflow = "hidden";
        });

    });

    // Recupera el scroll y devuelve el foco. Se llama desde cada vía
    // de cierre y otra vez desde el evento "close" como respaldo:
    // es seguro llamarla dos veces.
    function release() {
        document.body.style.overflow = "";
        if (opener) {
            opener.focus();
            opener = null;
        }
    }

    function closeModal(modal) {
        modal.close();
        release();
    }

    document.querySelectorAll(".project-modal").forEach(modal => {

        const close = modal.querySelector(".project-modal-close");
        if (close) close.addEventListener("click", () => closeModal(modal));

        // Clic fuera del cuadro: el clic llega al propio <dialog>
        modal.addEventListener("click", event => {
            if (event.target === modal) closeModal(modal);
        });

        // Escape (lo gestiona el navegador: "cancel" y después "close")
        modal.addEventListener("cancel", release);
        modal.addEventListener("close", release);

    });

})();


// =========================================================
// SECCIÓN ACTIVA
// ---------------------------------------------------------
// Una sola fuente de verdad para "en qué sección estoy":
// la sección que cruza la línea central de la pantalla.
// Publica el resultado en <html data-section>, marca el punto
// de navegación (aria-current) y avisa con el evento
// "i2:section" (lo usa js/cables.js).
// =========================================================

(() => {

    const SECTION_IDS = ["home", "about", "light", "logic", "create", "contact"];
    const sections = SECTION_IDS
        .map(id => document.getElementById(id))
        .filter(Boolean);

    const navLinks = new Map(
        [...document.querySelectorAll('nav a[href^="#"]')]
            .map(link => [link.getAttribute("href").slice(1), link])
    );

    let current = null;

    function activate(id) {
        if (id === current) return;
        current = id;

        document.documentElement.dataset.section = id;

        navLinks.forEach((link, key) => {
            if (key === id) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
        });

        document.dispatchEvent(new CustomEvent("i2:section", { detail: { id } }));
    }

    if (!sections.length) return;

    if (!("IntersectionObserver" in window)) {
        activate(sections[0].id);
        return;
    }

    // Banda fina en el centro de la pantalla. Si dos secciones la
    // tocan a la vez (justo en el borde), manda la de más abajo:
    // es la que ya ha cruzado la línea.
    const crossing = new Set();

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) crossing.add(entry.target);
            else crossing.delete(entry.target);
        });

        const active = sections.filter(section => crossing.has(section)).pop();
        if (active) activate(active.id);
    }, { rootMargin: "-50% 0px -49% 0px" });

    sections.forEach(section => observer.observe(section));

})();


// =========================================================
// TEMA CLARO / OSCURO
// ---------------------------------------------------------
// El tema inicial lo aplica el script del <head> antes de pintar
// (misma clave de almacenamiento). Aquí: botón, persistencia y
// seguir al sistema mientras no haya una elección manual.
// =========================================================

(() => {

    const root = document.documentElement;
    const button = document.getElementById("theme-toggle");
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const STORAGE_KEY = "i2byluciia-theme";
    const THEME_COLORS = { light: "#F5F1E8", dark: "#1E1C21" };
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    function readSaved() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved === "light" || saved === "dark" ? saved : null;
        } catch (error) {
            return null;   // almacenamiento bloqueado: se sigue al sistema
        }
    }

    function save(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {
            // El tema sigue funcionando aunque no se pueda guardar.
        }
    }

    // Transición de color breve solo al cambiar de tema, para no
    // interferir con las transiciones propias de cada elemento.
    let transitionTimer = 0;
    function softenChange() {
        if (reduced.matches) return;
        root.classList.add("theme-changing");
        clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => root.classList.remove("theme-changing"), 350);
    }

    function apply(theme) {
        const isDark = theme === "dark";
        root.dataset.theme = isDark ? "dark" : "light";

        if (themeMeta) themeMeta.setAttribute("content", THEME_COLORS[root.dataset.theme]);

        if (button) {
            // Nombre fijo + estado pulsado: "Tema oscuro, activado/desactivado"
            button.setAttribute("aria-pressed", String(isDark));
            button.setAttribute("title", isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
        }
    }

    apply(readSaved() || (systemTheme.matches ? "dark" : "light"));

    if (button) {
        button.addEventListener("click", () => {
            const next = root.dataset.theme === "dark" ? "light" : "dark";
            softenChange();
            apply(next);
            save(next);
        });
    }

    // Sin elección manual guardada, se sigue al sistema
    systemTheme.addEventListener("change", event => {
        if (readSaved()) return;
        softenChange();
        apply(event.matches ? "dark" : "light");
    });

})();
