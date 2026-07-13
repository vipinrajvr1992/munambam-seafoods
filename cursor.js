const fish = document.createElement('div');
fish.id = 'fish-cursor';
fish.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" style="fill:none; stroke:#C5A059; stroke-width:2;">
    <path d="M26,16 C26,22 20,26 12,26 C4,26 2,22 2,16 C2,10 4,6 12,6 C20,6 26,10 26,16 Z M26,16 L32,10 M26,16 L32,22 M10,6 C10,6 8,10 8,16 C8,22 10,26 10,26" />
    <circle cx="6" cy="16" r="1.5" fill="#C5A059"/>
</svg>`;
document.body.appendChild(fish);

const style = document.createElement('style');
style.innerHTML = `
    #fish-cursor {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
    }
`;
document.head.appendChild(style);

document.addEventListener('mousemove', (e) => {
    fish.style.left = (e.clientX - 16) + 'px';
    fish.style.top = (e.clientY - 16) + 'px';
});
