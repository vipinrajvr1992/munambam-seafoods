const fish = document.createElement('div');
fish.id = 'fish-cursor';

// ചിത്രത്തിലുള്ള അതേ പെർഫെക്റ്റ് ഷേപ്പ് ലഭിക്കാൻ പുതിയ പാത്ത്
fish.innerHTML = `<svg width="50" height="30" viewBox="0 0 50 30" style="fill:none; stroke:#C5A059; stroke-width:2; stroke-linecap:round;">
    <!-- മീനിന്റെ ശരീരവും വാലും (രണ്ട് വളഞ്ഞ വരകൾ എക്സ് ആകൃതിയിൽ ക്രോസ് ചെയ്യുന്നത്) -->
    <path d="M 5,15 Q 25,-5 45,25 M 5,15 Q 25,35 45,5" />
    
    <!-- തലയുടെ ഭാഗത്തെ വളഞ്ഞ വര -->
    <path d="M 15,8.5 Q 18,15 15,21.5" />
    
    <!-- കണ്ണ് -->
    <circle cx="10" cy="14.5" r="1.5" fill="#C5A059" stroke="none"/>
</svg>`;

document.body.appendChild(fish);

const style = document.createElement('style');
style.innerHTML = `
    #fish-cursor {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        /* മൗസ് പോയിന്റർ കൃത്യം മീനിന്റെ ചുണ്ടിൽ (മൂക്കിൽ) വരാൻ */
        transform: translate(-5px, -15px);
        transition: transform 0.05s linear;
    }
`;
document.head.appendChild(style);

document.addEventListener('mousemove', (e) => {
    fish.style.left = e.clientX + 'px';
    fish.style.top = e.clientY + 'px';
});
