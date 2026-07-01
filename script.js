const SUPABASE_URL = "https://lstxqfpzuitaqbjvlbma.supabase.co";
const SUPABASE_KEY = "sb_publishable_7joUByBeS0gQx8o_pKEpBQ_AdACfuJl";
const REFRESH_DELAY = 10000;

// Tous les points d'affichage sont centralisés ici pour éviter de modifier le HTML.
const elements = {
    goal: document.querySelector("#goalAmount"),
    raised: document.querySelector("#raisedAmount"),
    remaining: document.querySelector("#remainingAmount"),
    percentage: document.querySelector("#percentageAmount"),
    percentageHero: document.querySelector("#percentageText"),
    progressFill: document.querySelector("#progressFill"),
    updatedAt: document.querySelector("#updatedAt"),
    status: document.querySelector("#statusText"),
    donationLink: document.querySelector("#donationLink"),
    qrBox: document.querySelector(".qr-box"),
    qrCodeImage: document.querySelector("#qrCodeImage")
};

const formatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
});

let currentState = {
    objectif: 0,
    collecte: 0,
    percentage: 0,
    remaining: 0
};

let hasLoadedOnce = false;
let hasCelebratedGoal = false;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function calculateProgress(data) {
    const objectif = Number(data.objectif) || 0;
    const collecte = Number(data.collecte) || 0;
    const remaining = Math.max(objectif - collecte, 0);
    const percentage = objectif > 0 ? clamp((collecte / objectif) * 100, 0, 100) : 0;

    return { objectif, collecte, remaining, percentage };
}

function formatPercentage(value) {
    return `${Math.round(value)}%`;
}

function animateNumber(element, from, to, formatValue) {
    const duration = 900;
    const start = performance.now();

    element.classList.remove("value-updated");
    void element.offsetWidth;
    element.classList.add("value-updated");

    function tick(now) {
        const progress = clamp((now - start) / duration, 0, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const nextValue = from + (to - from) * easedProgress;

        element.textContent = formatValue(nextValue);

        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    }

    requestAnimationFrame(tick);
}

function updateTimestamp() {
    const now = new Date();
    elements.updatedAt.textContent = now.toLocaleString("fr-FR", {
        dateStyle: "long",
        timeStyle: "medium"
    });
}

function updateDonationContent(data) {
    const donationUrl = typeof data.lienDon === "string" ? data.lienDon.trim() : "";
    const qrCodeUrl = typeof data.qrCode === "string" ? data.qrCode.trim() : "";

    if (donationUrl) {
        elements.donationLink.href = donationUrl;
        elements.donationLink.classList.remove("is-disabled");
        elements.donationLink.removeAttribute("aria-disabled");
    } else {
        elements.donationLink.href = "#";
        elements.donationLink.classList.add("is-disabled");
        elements.donationLink.setAttribute("aria-disabled", "true");
    }

    if (qrCodeUrl) {
        elements.qrCodeImage.src = qrCodeUrl;
        elements.qrBox.classList.add("has-image");
    } else {
        elements.qrCodeImage.src = "qr-code.png";
        elements.qrBox.classList.add("has-image");
    }
}

function launchCelebration() {
    const colors = ["#f1ca6d", "#fff0bd", "#ffffff", "#d7a945", "#7bb8ff"];
    const pieces = 90;

    document.body.classList.add("celebrating");
    window.setTimeout(() => document.body.classList.remove("celebrating"), 1900);

    for (let index = 0; index < pieces; index += 1) {
        const piece = document.createElement("span");
        const size = 7 + Math.random() * 9;

        piece.className = "confetti-piece";
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.width = `${size}px`;
        piece.style.height = `${size * 1.45}px`;
        piece.style.background = colors[index % colors.length];
        piece.style.setProperty("--drift", `${Math.random() * 220 - 110}px`);
        piece.style.setProperty("--fall-duration", `${2200 + Math.random() * 1700}ms`);

        document.body.appendChild(piece);
        piece.addEventListener("animationend", () => piece.remove());
    }
}

function renderProgress(nextState) {
    // Les chiffres s'animent uniquement après le premier chargement, quand data.json change.
    const changed = nextState.collecte !== currentState.collecte || nextState.objectif !== currentState.objectif;
    const shouldAnimate = hasLoadedOnce && changed;

    if (shouldAnimate) {
        animateNumber(elements.goal, currentState.objectif, nextState.objectif, formatter.format);
        animateNumber(elements.raised, currentState.collecte, nextState.collecte, formatter.format);
        animateNumber(elements.remaining, currentState.remaining, nextState.remaining, formatter.format);
        animateNumber(elements.percentage, currentState.percentage, nextState.percentage, formatPercentage);
        animateNumber(elements.percentageHero, currentState.percentage, nextState.percentage, formatPercentage);
    } else {
        elements.goal.textContent = formatter.format(nextState.objectif);
        elements.raised.textContent = formatter.format(nextState.collecte);
        elements.remaining.textContent = formatter.format(nextState.remaining);
        elements.percentage.textContent = formatPercentage(nextState.percentage);
        elements.percentageHero.textContent = formatPercentage(nextState.percentage);
    }

    elements.progressFill.style.width = `${nextState.percentage}%`;
    elements.status.textContent = `${formatter.format(nextState.remaining)} restent à collecter pour atteindre l'objectif.`;

    if (nextState.collecte >= nextState.objectif && nextState.objectif > 0) {
        elements.status.textContent = "Objectif atteint. Merci pour votre générosité et votre engagement.";

        if (!hasCelebratedGoal) {
            launchCelebration();
            hasCelebratedGoal = true;
        }
    } else {
        hasCelebratedGoal = false;
    }

    updateTimestamp();

    currentState = nextState;
    hasLoadedOnce = true;
}

async function loadData() {
    try {

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/jauge?id=eq.1&select=*`,
            {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.length) {
            throw new Error("Aucune donnée trouvée.");
        }

        updateDonationContent({
            lienDon: "https://www.helloasso.com/associations/christ-refuge-pour-tous/collectes/achat-du-batiment",
            qrCode: "qr-code.png"
        });

        renderProgress(calculateProgress(data[0]));

    } catch (error) {

    console.error(error);
    alert(error.message);

    elements.status.textContent =
        "Impossible de récupérer la collecte.";

}
}

elements.donationLink.addEventListener("click", (event) => {
    if (elements.donationLink.classList.contains("is-disabled")) {
        event.preventDefault();
    }
});

loadData();
setInterval(loadData, REFRESH_DELAY);
