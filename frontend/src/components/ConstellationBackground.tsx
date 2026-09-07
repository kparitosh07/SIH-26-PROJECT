import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  pulseSpeed: number;
  pulsePhase: number;
  color: string;
  isKeyNode: boolean;
}

export const ConstellationBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    let particles: Particle[] = [];
    const maxConnectDistance = 140;
    const triangleMaxDistance = 100;

    const colors = ['#00f0ff', '#38bdf8', '#60a5fa', '#818cf8', '#3b82f6'];

    const initParticles = (w: number, h: number) => {
      particles = [];
      const particleCount = Math.min(Math.floor((w * h) / 11000), 90);
      for (let i = 0; i < particleCount; i++) {
        const isKeyNode = Math.random() < 0.25;
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.7,
          vy: (Math.random() - 0.5) * 0.7,
          radius: isKeyNode ? 3.5 + Math.random() * 1.5 : 1.5 + Math.random() * 1.5,
          baseAlpha: 0.5 + Math.random() * 0.5,
          pulseSpeed: 0.02 + Math.random() * 0.03,
          pulsePhase: Math.random() * Math.PI * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          isKeyNode,
        });
      }
    };

    const resize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      if (particles.length === 0) {
        initParticles(width, height);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    // Mouse tracking for subtle interaction
    let mouseX = -1000;
    let mouseY = -1000;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep electric gradient background
      const bgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        100,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8
      );
      bgGrad.addColorStop(0, '#060d24');
      bgGrad.addColorStop(0.5, '#040817');
      bgGrad.addColorStop(1, '#02040a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Vibrant corner glows matching reference image
      const topLeftGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.45);
      topLeftGlow.addColorStop(0, 'rgba(0, 180, 255, 0.18)');
      topLeftGlow.addColorStop(0.5, 'rgba(30, 64, 175, 0.08)');
      topLeftGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = topLeftGlow;
      ctx.fillRect(0, 0, width, height);

      const bottomRightGlow = ctx.createRadialGradient(width, height, 0, width, height, width * 0.5);
      bottomRightGlow.addColorStop(0, 'rgba(14, 165, 233, 0.16)');
      bottomRightGlow.addColorStop(0.6, 'rgba(3, 105, 161, 0.06)');
      bottomRightGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = bottomRightGlow;
      ctx.fillRect(0, 0, width, height);

      // Update positions & draw pulse
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Bounce boundaries
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Mouse attraction/repulsion gentle force
        const dxMouse = p.x - mouseX;
        const dyMouse = p.y - mouseY;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        if (distMouse < 120 && distMouse > 0) {
          const force = (120 - distMouse) / 120;
          p.x += (dxMouse / distMouse) * force * 0.6;
          p.y += (dyMouse / distMouse) * force * 0.6;
        }

        p.pulsePhase += p.pulseSpeed;
      }

      // Draw triangles for plexus mesh effect
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx12 = p1.x - p2.x;
          const dy12 = p1.y - p2.y;
          const dist12 = Math.sqrt(dx12 * dx12 + dy12 * dy12);

          if (dist12 < triangleMaxDistance) {
            for (let k = j + 1; k < particles.length; k++) {
              const p3 = particles[k];
              const dx23 = p2.x - p3.x;
              const dy23 = p2.y - p3.y;
              const dist23 = Math.sqrt(dx23 * dx23 + dy23 * dy23);

              const dx31 = p3.x - p1.x;
              const dy31 = p3.y - p1.y;
              const dist31 = Math.sqrt(dx31 * dx31 + dy31 * dy31);

              if (dist23 < triangleMaxDistance && dist31 < triangleMaxDistance) {
                const alpha = (1 - dist12 / triangleMaxDistance) *
                              (1 - dist23 / triangleMaxDistance) *
                              (1 - dist31 / triangleMaxDistance) * 0.15;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.closePath();
                ctx.fillStyle = `rgba(0, 160, 255, ${alpha})`;
                ctx.fill();
              }
            }
          }
        }
      }

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectDistance) {
            const alpha = (1 - dist / maxConnectDistance) * 0.45;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.lineWidth = dist < 50 ? 1.2 : 0.7;
            ctx.stroke();
          }
        }
      }

      // Draw particles / glowing nodes
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const alpha = p.baseAlpha * (0.7 + 0.3 * Math.sin(p.pulsePhase));

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        if (p.isKeyNode) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          // Outer halo ring for key nodes
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${Math.floor(alpha * 128).toString(16).padStart(2, '0')}`;
          ctx.fill();
        } else {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
        }
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};
