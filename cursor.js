const fish = document.createElement('div');
fish.id = 'fish-cursor';

// കൃത്യമായ ഫിഷ് ഷേപ്പ് ലഭിക്കാൻ പുതിയ പാത്ത് ഉപയോഗിക്കുന്നു
fish.innerHTML = `<svg width="50" height="30" viewBox="0 0 50 30" style="fill:none; stroke:#C5A059; stroke-width:2;">
    <!-- മീനിന്റെ ശരീരം -->
    <path d="M5,15 C5,5 40,5 40,15 C40,25 5,25 5,15 Z" />
    <!-- മീനിന്റെ വാല് -->
    <path d="M40,15 L50,5 M40,15 L50,25" />
    <!-- തലയുടെ ഭാഗത്തെ വര -->
    <path d="M15,5 C15,25" />
    <!-- കണ്ണ് -->
    <circle cx="10" cy="15" r="1.5" fill="#C5A059"/>
</svg>`;

document.body.appendChild(fish);

const style = document.createElement('style');
style.innerHTML = `
    #fish-cursor {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        /* മൗസ് പോയിന്റർ കൃത്യം മീനിന്റെ വായുടെ ഭാഗത്ത് വരാൻ */
        transform: translate(-5px, -15px);
        transition: transform 0.05s linear;
    }
`;
document.head.appendChild(style);

document.addEventListener('mousemove', (e) => {
    fish.style.left = e.clientX + 'px';
    fish.style.top = e.clientY + 'px';
});
