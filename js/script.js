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
    // individualmente. Las letras de cada palabra van dentro de otro
    // <span> que no se parte, así la línea solo puede cortarse entre
    // palabras (y no "Crea / te"). Los espacios se dejan como texto
    // normal para no romper el flujo del título.
    const text = title.textContent.trim();
    title.textContent = "";

    // Los lectores de pantalla leen el título completo, no letra a letra
    title.setAttribute("aria-label", text);

    text.split(" ").forEach((word, index) => {
        if (index > 0) title.appendChild(document.createTextNode(" "));

        const wordSpan = document.createElement("span");
        wordSpan.className = "lupa-word";
        wordSpan.setAttribute("aria-hidden", "true");

        word.split("").forEach(char => {
            const letter = document.createElement("span");
            letter.className = "lupa-letter";
            letter.textContent = char;
            wordSpan.appendChild(letter);
        });

        title.appendChild(wordSpan);
    });

    const letters = title.querySelectorAll(".lupa-letter");

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
// cerrar y bloqueo del contenido de detrás. Aquí:
//   - se abre desde "Ver proyecto" con el color de su sección;
//   - se cierra con ×, clic fuera o Escape, y el foco vuelve al
//     botón que lo abrió;
//   - "Proyecto anterior / siguiente" recorre los proyectos de la
//     misma sección sin cerrar (de forma circular);
//   - las fotos se abren en grande en el visor (más abajo).
// =========================================================

(() => {

    const BUTTONS = ".light-ver-proyecto, .logic-ver-proyecto, .create-ver-proyecto";

    let opener = null;

    // Proyectos de cada sección, en el orden de sus tarjetas
    const sections = {};
    document.querySelectorAll(BUTTONS).forEach(button => {
        const section = button.className.split("-")[0];   // light | logic | create
        const modal = document.getElementById(`modal-${button.dataset.project}`);
        if (!modal) return;
        (sections[section] = sections[section] || []).push(modal);
    });

    // Título del proyecto (sin el enlace que va dentro del <h3>)
    function projectTitle(modal) {
        const h3 = modal.querySelector("h3");
        if (!h3) return "";
        const text = [...h3.childNodes]
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent)
            .join(" ")
            .trim();
        return text || h3.textContent.trim();
    }

    function openModal(modal, section) {
        if (!modal || typeof modal.showModal !== "function") return;
        modal.dataset.accent = section;      // el modal toma el color de su sección
        modal.dataset.section = section;
        modal.showModal();
        const content = modal.querySelector(".project-modal-content");
        if (content) content.scrollTop = 0;
        updateNav(modal);

        // Bloquear scroll de la página
        document.body.style.overflow = "hidden";
    }

    document.querySelectorAll(BUTTONS).forEach(button => {
        button.addEventListener("click", () => {
            const modal = document.getElementById(`modal-${button.dataset.project}`);
            if (!modal) return;
            opener = button;
            openModal(modal, button.className.split("-")[0]);
        });
    });

    // Recupera el scroll y devuelve el foco. Se llama desde cada vía
    // de cierre y otra vez desde el evento "close" como respaldo: es
    // seguro llamarla dos veces. Si sigue abierto otro modal (al pasar
    // de un proyecto al siguiente) no hace nada.
    function release() {
        if (document.querySelector(".project-modal[open]")) return;
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

    // ── Proyecto anterior / siguiente ─────────────────────

    function neighbour(modal, step) {
        const list = sections[modal.dataset.section] || [];
        const index = list.indexOf(modal);
        if (index < 0 || list.length < 2) return null;
        return list[(index + step + list.length) % list.length];
    }

    function updateNav(modal) {
        const nav = modal.querySelector(".project-modal-nav");
        if (!nav) return;
        const prev = neighbour(modal, -1);
        const next = neighbour(modal, 1);
        nav.hidden = !prev;
        if (!prev) return;
        nav.querySelector(".project-nav-prev .project-nav-title").textContent = projectTitle(prev);
        nav.querySelector(".project-nav-next .project-nav-title").textContent = projectTitle(next);
    }

    function go(modal, step) {
        const target = neighbour(modal, step);
        if (!target) return;
        const section = modal.dataset.section;
        modal.close();                       // release() no actúa: se abre el siguiente
        openModal(target, section);
        const sameButton = target.querySelector(step > 0 ? ".project-nav-next" : ".project-nav-prev");
        if (sameButton) sameButton.focus();  // seguir navegando con el teclado
    }

    // Cada modal recibe su navegación al final del cuadro
    function buildNav(modal) {
        const content = modal.querySelector(".project-modal-content");
        if (!content) return;
        const nav = document.createElement("nav");
        nav.className = "project-modal-nav";
        nav.setAttribute("aria-label", "Otros proyectos");
        nav.innerHTML = `
            <button type="button" class="project-nav-prev">
                <span class="project-nav-label">← Anterior</span>
                <span class="project-nav-title"></span>
            </button>
            <button type="button" class="project-nav-next">
                <span class="project-nav-label">Siguiente →</span>
                <span class="project-nav-title"></span>
            </button>`;
        nav.querySelector(".project-nav-prev").addEventListener("click", () => go(modal, -1));
        nav.querySelector(".project-nav-next").addEventListener("click", () => go(modal, 1));
        content.appendChild(nav);
    }

    document.querySelectorAll(".project-modal").forEach(modal => {

        buildNav(modal);

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


    // ── Visor de fotos ────────────────────────────────────
    // Las fotos de cada proyecto (principal y galería) se abren en
    // grande sobre el modal. Flechas, teclado (← → Escape) y
    // deslizamiento con el dedo. Las fotos son enfocables.

    const viewer = document.getElementById("lightbox");
    if (!viewer || typeof viewer.showModal !== "function") return;

    const viewerImg     = viewer.querySelector(".lightbox-img");
    const viewerText    = viewer.querySelector(".lightbox-text");
    const viewerCount   = viewer.querySelector(".lightbox-count");
    let photos = [];
    let current = 0;
    let photoOpener = null;

    function show(index) {
        current = (index + photos.length) % photos.length;
        const photo = photos[current];
        viewerImg.src = photo.currentSrc || photo.src;
        viewerImg.alt = photo.alt;
        viewerText.textContent = photo.alt;
        viewerCount.textContent = photos.length > 1 ? `${current + 1} / ${photos.length}` : "";
        viewer.classList.toggle("is-single", photos.length < 2);
    }

    function openViewer(modal, photo) {
        photos = [...modal.querySelectorAll(".project-modal-header img, .project-modal-gallery-grid img")];
        photoOpener = photo;
        viewer.dataset.accent = modal.dataset.accent || "light";
        show(photos.indexOf(photo));
        viewer.showModal();
    }

    function closeViewer() {
        if (viewer.open) viewer.close();
        if (photoOpener) {
            photoOpener.focus();
            photoOpener = null;
        }
    }

    document.querySelectorAll(".project-modal").forEach(modal => {
        modal.querySelectorAll(".project-modal-header img, .project-modal-gallery-grid img").forEach(photo => {
            photo.tabIndex = 0;
            photo.setAttribute("role", "button");
            photo.setAttribute("aria-label", `Ver en grande: ${photo.alt}`);
            photo.addEventListener("click", () => openViewer(modal, photo));
            photo.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openViewer(modal, photo);
                }
            });
        });
    });

    viewer.querySelector(".lightbox-prev").addEventListener("click", () => show(current - 1));
    viewer.querySelector(".lightbox-next").addEventListener("click", () => show(current + 1));
    viewer.querySelector(".lightbox-close").addEventListener("click", closeViewer);

    // Clic en el fondo (fuera de la foto y de los botones)
    viewer.addEventListener("click", event => {
        if (event.target === viewer || event.target.classList.contains("lightbox-figure")) closeViewer();
    });

    viewer.addEventListener("keydown", event => {
        if (event.key === "ArrowLeft")  { event.preventDefault(); show(current - 1); }
        if (event.key === "ArrowRight") { event.preventDefault(); show(current + 1); }
    });

    // Escape cierra solo el visor (el modal del proyecto sigue abierto)
    viewer.addEventListener("cancel", () => {
        if (photoOpener) {
            setTimeout(() => {
                if (photoOpener) { photoOpener.focus(); photoOpener = null; }
            }, 0);
        }
    });

    // Deslizar con el dedo
    let touchX = null;
    viewer.addEventListener("touchstart", event => {
        touchX = event.touches[0].clientX;
    }, { passive: true });
    viewer.addEventListener("touchend", event => {
        if (touchX === null) return;
        const dx = event.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    }, { passive: true });

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
        [...document.querySelectorAll('header nav a[href^="#"]')]
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
