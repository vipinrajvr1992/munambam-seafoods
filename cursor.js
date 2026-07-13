const fish = document.createElement('div');
fish.id = 'fish-cursor';

// കൃത്യമായ ഫിഷ് ഷേപ്പ് ലഭിക്കാൻ പാത്ത് അപ്‌ഡേറ്റ് ചെയ്തു
fish.innerHTML = `<svg width="40" height="20" viewBox="0 0 40 20" style="fill:none; stroke:#C5A059; stroke-width:1.5;">
    <!-- മീനിന്റെ ശരീരവും വാലും ചേർന്ന് കിടക്കുന്ന പാത്ത് -->
    <path d="M2,10 C2,1 38,1 38,10 C38,19 2,19 2,10 Z M30,10 L39,2 M30,10 L39,18" />
    <!-- തലയുടെ ഭാഗത്തെ വര -->
    <path d="M12,2 C12,18" />
    <!-- കണ്ണ് -->
    <circle cx="8" cy="10" r="1.2" fill="#C5A059"/>
</svg>`;

document.body.appendChild(fish);

const style = document.createElement('style');
style.innerHTML = `
    #fish-cursor {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        /* മൗസ് പോയിന്റർ മീനിന്റെ മധ്യഭാഗത്തായി വരാൻ */
        transform: translate(-10px, -10px);
        transition: transform 0.05s linear;
    }
`;
document.head.appendChild(style);

document.addEventListener('mousemove', (e) => {
    fish.style.left = e.clientX + 'px';
    fish.style.top = e.clientY + 'px';
});
