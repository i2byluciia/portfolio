// =========================================================
// MODALES DE PROYECTOS
// =========================================================

const projectButtons = document.querySelectorAll(".light-ver-proyecto, .logic-ver-proyecto, .create-ver-proyecto");

projectButtons.forEach(button => {

    button.addEventListener("click", () => {

        const project = button.dataset.project;

        if (!project) return;

        const modal = document.getElementById(`modal-${project}`);

        if (!modal) return;

        modal.style.display = "flex";

    });

});


// =========================================================
// CERRAR MODAL
// =========================================================

const closeButtons = document.querySelectorAll(".project-modal-close");

closeButtons.forEach(button => {

    button.addEventListener("click", () => {

        const modal = button.closest(".project-modal");

        if (!modal) return;

        modal.style.display = "none";

    });

});


// =========================================================
// CERRAR AL PULSAR FUERA DEL CUADRO
// =========================================================

const modals = document.querySelectorAll(".project-modal");

modals.forEach(modal => {

    modal.addEventListener("click", event => {

        if (event.target === modal) {
            modal.style.display = "none";
        }

    });

});