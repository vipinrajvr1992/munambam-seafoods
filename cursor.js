// cursor.js - Munambam Seafoods Ocean Theme Custom Cursor

const fish = document.createElement('div');
fish.id = 'fish-cursor';

// നിങ്ങളുണ്ടാക്കിയ അതേ ഒറിജിനൽ ഫിഷ് ഷേപ്പ് (Shape), പക്ഷേ പുതിയ വെബ്‌സൈറ്റിന് അനുയോജ്യമായ കളർ നവീകരണം
fish.innerHTML = `<svg width="50" height="30" viewBox="0 0 50 30" style="fill:none; stroke:#0284c7; stroke-width:2.5; stroke-linecap:round; filter: drop-shadow(0px 2px 4px rgba(2, 132, 199, 0.4));">
    <!-- മീനിന്റെ ശരീരവും വാലും (നിങ്ങൾ നിർമ്മിച്ച അതേ ഒറിജിനൽ പാത്ത്) -->
    <path d="M 5,15 Q 25,-5 45,25 M 5,15 Q 25,35 45,5" />
    
    <!-- തലയുടെ ഭാഗത്തെ വളഞ്ഞ വര -->
    <path d="M 15,8.5 Q 18,15 15,21.5" />
    
    <!-- കണ്ണ് -->
    <circle cx="10" cy="14.5" r="1.8" fill="#064e3b" stroke="none"/>
</svg>`;

document.body.appendChild(fish);

const style = document.createElement('style');
style.innerHTML = `
    #fish-cursor {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        /* മൗസ് പോയിന്റർ കൃത്യം മീനിന്റെ ചുണ്ടിൽ വരാൻ */
        transform: translate(-5px, -15px);
        transition: transform 0.05s linear;
    }
`;
document.head.appendChild(style);

document.addEventListener('mousemove', (e) => {
    fish.style.left = e.clientX + 'px';
    fish.style.top = e.clientY + 'px';
});
