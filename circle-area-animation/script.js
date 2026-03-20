// Register the ScrollTrigger plugin with GSAP
gsap.registerPlugin(ScrollTrigger);

const svg = document.getElementById('pizza-svg');
const N = 16; // 16 slices
const R = 150; // Radius
const sliceAngle = 360 / N; // 22.5 degrees
const sliceAngleRad = sliceAngle * Math.PI / 180;

const startRad = (-90 - (sliceAngle / 2)) * Math.PI / 180;
const endRad = (-90 + (sliceAngle / 2)) * Math.PI / 180;

function getSlicePath(r, start, end) {
    const startX = Math.cos(start) * r;
    const startY = Math.sin(start) * r;
    const endX = Math.cos(end) * r;
    const endY = Math.sin(end) * r;
    // large-arc-flag is 0 for angles < 180
    return `M 0 0 L ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY} Z`;
}

const slicePath = getSlicePath(R, startRad, endRad);
const slices = [];

// Create the 16 slices and add them to the SVG
for (let i = 0; i < N; i++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', slicePath);
    path.setAttribute('fill', i % 2 === 0 ? 'url(#grad-even)' : 'url(#grad-odd)');
    path.setAttribute('stroke', '#0f172a'); 
    path.setAttribute('stroke-width', '0.5');
    path.setAttribute('class', `slice slice-${i}`);
    
    gsap.set(path, { transformOrigin: "0px 0px" });
    svg.insertBefore(path, document.getElementById('label-width'));
    slices.push(path);
}

const W = 2 * R * Math.sin(sliceAngleRad / 2); 
const numPairs = N / 2; 
const offsetX = -((numPairs - 1 + 0.5) * W) / 2;

function getClosestRotation(current, target) {
    let diff = (target - current) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return current + diff;
}

slices.forEach((slice, i) => {
    gsap.set(slice, {
        x: 0,
        y: 0,
        rotation: i * sliceAngle
    });
});

const tl = gsap.timeline({
    scrollTrigger: {
        trigger: ".scroll-container",
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        onUpdate: (self) => {
            const p = self.progress;
            
            document.querySelectorAll('.step').forEach((el, i) => {
                let isActive = false;
                if (i === 0 && p < 0.20) isActive = true;
                if (i === 1 && p >= 0.20 && p < 0.45) isActive = true;
                if (i === 2 && p >= 0.45 && p < 0.70) isActive = true;
                if (i === 3 && p >= 0.70) isActive = true;
                el.classList.toggle('active', isActive);
            });
        }
    }
});

tl.to(slices, {
    x: (i) => {
        const rad = (i * sliceAngle - 90) * Math.PI / 180;
        return Math.cos(rad) * 40; 
    },
    y: (i) => {
        const rad = (i * sliceAngle - 90) * Math.PI / 180;
        return Math.sin(rad) * 40;
    },
    duration: 1,
    ease: "power2.inOut"
});

tl.to(slices, {
    x: (i) => {
        const isEven = i % 2 === 0;
        const k = Math.floor(i / 2); 
        const X = isEven ? k * W : k * W + W / 2;
        return X + offsetX;
    },
    y: (i) => {
        const isEven = i % 2 === 0;
        return isEven ? R / 2 + 80 : -R / 2 - 80;
    },
    rotation: (i) => {
        const isEven = i % 2 === 0;
        const target = isEven ? 0 : 180;
        const current = i * sliceAngle;
        return getClosestRotation(current, target);
    },
    duration: 1.5,
    ease: "power2.inOut"
});

tl.to(slices, {
    y: (i) => {
        const isEven = i % 2 === 0;
        return isEven ? R / 2 : -R / 2;
    },
    duration: 1.2,
    ease: "back.out(1.2)"
});

tl.to(['#label-width', '#label-height', '#brace-width', '#brace-height'], {
    opacity: 1,
    duration: 0.5,
    ease: "none"
});
