'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCollaborativeRipples, COLORS } from './useCollaborativeRipples';

interface InteractiveDotGridProps {
    dotColor?: string;
    highlightColor?: string;
    gap?: number;
    dotRadius?: number;
    backgroundColor?: string;
    className?: string;
}

const InteractiveDotGrid: React.FC<InteractiveDotGridProps> = ({
    dotColor = '#e8e8e8',
    highlightColor = '#4285F4',
    gap = 30,
    dotRadius = 2,
    backgroundColor = '#ffffff',
    className = '',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const { ripples, clickBursts, addRipple, addClickBurst } = useCollaborativeRipples(dimensions);
    const lastRipplePos = useRef({ x: 0, y: 0 });
    const isMouseDown = useRef(false);
    const currentColor = useRef(COLORS[0]);
    const animationFrameId = useRef<number>(0);
    const RIPPLE_SPACING = 150; // Increased from 100 - fewer ripples during drag, still smooth

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', {
            alpha: true,
            desynchronized: true,
            willReadFrequently: false
        });
        if (!ctx) return;

        let dotPositions: { x: number; y: number }[] = [];
        let needsRecalcDots = true;
        let width = 0;
        let height = 0;

        const calculateDotPositions = () => {
            dotPositions = [];
            const startX = (width % gap) / 2;
            const startY = (height % gap) / 2;
            const cols = Math.ceil(width / gap);
            const rows = Math.ceil(height / gap);

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    dotPositions.push({
                        x: startX + col * gap,
                        y: startY + row * gap
                    });
                }
            }
            needsRecalcDots = false;
        };

        const render = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            const newWidth = rect.width * dpr;
            const newHeight = rect.height * dpr;

            if (canvas.width !== newWidth || canvas.height !== newHeight) {
                canvas.width = newWidth;
                canvas.height = newHeight;
                width = rect.width;
                height = rect.height;
                needsRecalcDots = true;
                setDimensions({ width: rect.width, height: rect.height });
            }

            ctx.scale(dpr, dpr);

            if (needsRecalcDots) {
                calculateDotPositions();
            }

            if (backgroundColor === 'transparent') {
                ctx.clearRect(0, 0, width, height);
            } else {
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, width, height);
            }

            for (let i = ripples.length - 1; i >= 0; i--) {
                const ripple = ripples[i];
                ripple.radius += ripple.isDrag ? 1.8 : 2.5;
                ripple.life -= ripple.isDrag ? 0.004 : 0.01;

                if (ripple.life <= 0 || ripple.radius > ripple.maxRadius) {
                    ripples.splice(i, 1);
                }
            }

            for (let i = clickBursts.length - 1; i >= 0; i--) {
                clickBursts[i].life -= 0.05;
                if (clickBursts[i].life <= 0) {
                    clickBursts.splice(i, 1);
                }
            }

            for (const dot of dotPositions) {
                let maxInfluence = 0;
                let dominantColor = null;
                let isDragRipple = false;

                for (const ripple of ripples) {
                    const dx = dot.x - ripple.x;
                    const dy = dot.y - ripple.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const edgeDistance = Math.abs(dist - ripple.radius);
                    const ringWidth = ripple.isDrag ? 65 : 40;

                    if (edgeDistance < ringWidth) {
                        const influence = (1 - edgeDistance / ringWidth) * ripple.life;
                        if (influence > maxInfluence) {
                            maxInfluence = influence;
                            dominantColor = ripple.color;
                            isDragRipple = ripple.isDrag;
                        }
                    }
                }

                if (dominantColor && maxInfluence > 0.05) {
                    const blend = isDragRipple ? maxInfluence * 0.75 : maxInfluence * 0.90;

                    const r = 230 + (dominantColor.r - 230) * blend;
                    const g = 230 + (dominantColor.g - 230) * blend;
                    const b = 230 + (dominantColor.b - 230) * blend;
                    const size = dotRadius + maxInfluence * 1.3;
                    const opacity = maxInfluence * 0.85;

                    ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${opacity})`;
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            for (const burst of clickBursts) {
                const alpha = burst.life;
                const size = (1 - burst.life) * 20 + 5;

                ctx.strokeStyle = `rgba(${burst.color.r}, ${burst.color.g}, ${burst.color.b}, ${alpha * 0.8})`;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, size, 0, Math.PI * 2);
                ctx.stroke();

                const gradient = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, size * 0.6);
                gradient.addColorStop(0, `rgba(${burst.color.r}, ${burst.color.g}, ${burst.color.b}, ${alpha * 0.6})`);
                gradient.addColorStop(1, `rgba(${burst.color.r}, ${burst.color.g}, ${burst.color.b}, 0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, size * 0.6, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            animationFrameId.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, [dotColor, highlightColor, gap, dotRadius, backgroundColor, ripples, clickBursts]);

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        isMouseDown.current = true;
        lastRipplePos.current = { x, y };
        currentColor.current = COLORS[Math.floor(Math.random() * COLORS.length)];

        addRipple(x, y, currentColor.current, false);
        addClickBurst(x, y, currentColor.current);
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isMouseDown.current) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const dx = x - lastRipplePos.current.x;
        const dy = y - lastRipplePos.current.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > RIPPLE_SPACING * RIPPLE_SPACING) {
            addRipple(x, y, currentColor.current, true);
            lastRipplePos.current = { x, y };
        }
    };

    const handleMouseUp = () => {
        isMouseDown.current = false;
    };

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ width: '100%', height: '100%', background: backgroundColor }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
        />
    );
};

export default InteractiveDotGrid;
