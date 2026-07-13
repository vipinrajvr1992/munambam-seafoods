const fish = document.createElement('div');
fish.id = 'fish-cursor';
// ഇവിടെ viewBox വലിപ്പം കൂട്ടി, പാത്ത് കൃത്യമാക്കിയിട്ടുണ്ട്
fish.innerHTML = `<svg width="40" height="20" viewBox="0 0 40 20" style="fill:none; stroke:#C5A059; stroke-width:1.5;">
    <path d="M1,10 C1,1 39,1 39,10 C39,19 1,19 1,10 Z M28,10 L39,2 M28,10 L39,18 M15,2 C15,2 14,10 14,10 C14,18 15,18 15,18" />
    <circle cx="12" cy="10" r="1" fill="#C5A059"/>
</svg>`;
document.body.appendChild(fish);

const style = document.createElement('style');
style.innerHTML = `
    #fish-cursor {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        /* മൗസ് പോയിന്റർ മീനിന്റെ തല ഭാഗത്തായി വരാൻ */
        transform: translate(-10px, -10px);
    }
`;
document.head.appendChild(style);

document.addEventListener('mousemove', (e) => {
    fish.style.left = e.clientX + 'px';
    fish.style.top = e.clientY + 'px';
});
