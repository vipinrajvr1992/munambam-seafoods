// ============================================================
// MUNAMBAM SEAFOODS — OCEAN FISH CURSOR
// Desktop only — NEVER show the browser default cursor
// ============================================================

(() => {
    // ------------------------------------------------------------
    // Desktop only
    // ------------------------------------------------------------
    if (window.innerWidth <= 1024) return;

    // ------------------------------------------------------------
    // Force native cursor OFF everywhere on desktop
    // This prevents the browser cursor appearing over:
    // links, buttons, navigation, SVGs, images, text, etc.
    // ------------------------------------------------------------
    const cursorStyle = document.createElement("style");

    cursorStyle.id = "munambam-cursor-lock";

    cursorStyle.textContent = `
        @media (min-width: 1025px) {
            html,
            body,
            body * {
                cursor: none !important;
            }

            #fish-cursor,
            #fish-cursor * {
                cursor: none !important;
            }
        }
    `;

    document.head.appendChild(cursorStyle);

    // ------------------------------------------------------------
    // Create fish cursor
    // ------------------------------------------------------------
    const fish = document.createElement("div");

    fish.id = "fish-cursor";
    fish.setAttribute("aria-hidden", "true");

    fish.innerHTML = `
        <svg
            width="50"
            height="30"
            viewBox="0 0 50 30"
            fill="none"
            stroke="#0284c7"
            stroke-width="2.5"
            stroke-linecap="round"
            aria-hidden="true"
        >
            <path d="M 5,15 Q 25,-5 45,25" />
            <path d="M 5,15 Q 25,35 45,5" />

            <path d="M 15,8.5 Q 18,15 15,21.5" />

            <circle
                cx="10"
                cy="14.5"
                r="1.8"
                fill="#064e3b"
                stroke="none"
            />
        </svg>
    `;

    document.body.appendChild(fish);

    // ------------------------------------------------------------
    // Cursor styling
    // ------------------------------------------------------------
    const fishStyle = document.createElement("style");

    fishStyle.textContent = `
        #fish-cursor {
            position: fixed;
            left: 0;
            top: 0;

            width: 50px;
            height: 30px;

            pointer-events: none;

            z-index: 2147483647;

            transform: translate3d(-5px, -15px, 0);

            will-change: left, top, transform;

            user-select: none;
            -webkit-user-select: none;

            visibility: visible;
            opacity: 1;
        }

        #fish-cursor svg {
            display: block;

            width: 50px;
            height: 30px;

            pointer-events: none;
            user-select: none;

            filter:
                drop-shadow(
                    0 2px 4px
                    rgba(2, 132, 199, 0.4)
                );
        }
    `;

    document.head.appendChild(fishStyle);

    // ------------------------------------------------------------
    // Mouse movement
    // ------------------------------------------------------------
    document.addEventListener(
        "mousemove",
        (e) => {
            fish.style.left = `${e.clientX}px`;
            fish.style.top = `${e.clientY}px`;
        },
        {
            passive: true
        }
    );

    // ------------------------------------------------------------
    // Extra protection:
    // Keep native cursor hidden during mouse interaction.
    // ------------------------------------------------------------
    document.addEventListener(
        "mousedown",
        () => {
            document.documentElement.style.setProperty(
                "cursor",
                "none",
                "important"
            );

            document.body.style.setProperty(
                "cursor",
                "none",
                "important"
            );
        },
        {
            passive: true
        }
    );

    // ------------------------------------------------------------
    // Keep cursor hidden when pointer enters the document again
    // ------------------------------------------------------------
    document.addEventListener(
        "mouseenter",
        () => {
            document.documentElement.style.setProperty(
                "cursor",
                "none",
                "important"
            );

            document.body.style.setProperty(
                "cursor",
                "none",
                "important"
            );
        },
        {
            passive: true
        }
    );

})();
