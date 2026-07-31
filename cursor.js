// --- 1. Create and Append Fish Cursor ---
const fish = document.createElement('div');
fish.id = 'fish-cursor';

fish.innerHTML = `<svg width="50" height="30" viewBox="0 0 50 30" style="fill:none; stroke:#C5A059; stroke-width:2; stroke-linecap:round;">
    <!-- മീനിന്റെ ശരീരവും വാലും -->
    <path d="M 5,15 Q 25,-5 45,25 M 5,15 Q 25,35 45,5" />
    <!-- തലയുടെ ഭാഗത്തെ വളഞ്ഞ വര -->
    <path d="M 15,8.5 Q 18,15 15,21.5" />
    <!-- കണ്ണ് -->
    <circle cx="10" cy="14.5" r="1.5" fill="#C5A059" stroke="none"/>
</svg>`;

document.body.appendChild(fish);

// --- 2. Create Water Bubbles for Trail Animation ---
const bubbleCount = 5;
const circles = [];

for (let i = 0; i < bubbleCount; i++) {
  const bubble = document.createElement('div');
  bubble.className = 'cursor-bubble';
  document.body.appendChild(bubble);
  circles.push(bubble);
}

const coords = { x: 0, y: 0 };

circles.forEach(function (circle) {
  circle.x = 0;
  circle.y = 0;
});

// --- 3. Mouse Move Event Listener ---
window.addEventListener('mousemove', (e) => {
  coords.x = e.clientX;
  coords.y = e.clientY;

  // Fish position update
  fish.style.left = e.clientX + 'px';
  fish.style.top = e.clientY + 'px';
});

// --- 4. Smooth Animation Loop for Water Trail ---
function animateCircles() {
  let x = coords.x;
  let y = coords.y;

  circles.forEach(function (circle, index) {
    circle.style.left = x + 'px';
    circle.style.top = y + 'px';

    circle.style.transform = `translate(-50%, -50%) scale(${(circles.length - index) / circles.length})`;

    circle.x = x;
    circle.y = y;

    const nextCircle = circles[index + 1] || circles[0];
    x += (nextCircle.x - x) * 0.3;
    y += (nextCircle.y - y) * 0.3;
  });

  requestAnimationFrame(animateCircles);
}

animateCircles();
