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