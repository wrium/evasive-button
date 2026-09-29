import { describe, it, expect } from 'vitest';
import { isNearTarget, calculateEvasionOffset, getBoundingContainer } from '../index.js';

describe('Evasive Button: Core Calculations', () => {
    describe('isNearTarget', () => {
        const targetRect = {
            left: 100,
            top: 100,
            width: 100,
            height: 40
        };

        it('detects when cursor is within threshold', () => {
            // Cursor is at (90, 100) -> 10px from left edge
            const res = isNearTarget({ x: 90, y: 100 }, targetRect, 50);
            expect(res.isNear).toBe(true);
            expect(res.distance).toBe(10);
        });

        it('detects when cursor is outside threshold', () => {
            // Cursor is at (20, 20) -> far away
            const res = isNearTarget({ x: 20, y: 20 }, targetRect, 50);
            expect(res.isNear).toBe(false);
            expect(res.distance).toBeGreaterThan(50);
        });

        it('reports zero distance when cursor is inside the target', () => {
            const res = isNearTarget({ x: 120, y: 110 }, targetRect, 50);
            expect(res.isNear).toBe(true);
            expect(res.distance).toBe(0);
        });
    });

    describe('calculateEvasionOffset', () => {
        const elSize = { width: 100, height: 40 };
        const naturalPos = { left: 150, top: 150 };
        // Container spans (0, 0) to (500, 400)
        const bounds = { left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400 };

        it('moves element away from incoming cursor from the left', () => {
            // Button center is at (200, 170). Cursor approaches from left (140, 170)
            const cursor = { x: 140, y: 170 };
            const offset = calculateEvasionOffset(
                cursor,
                elSize,
                naturalPos,
                bounds,
                { x: 0, y: 0 },
                { distance: 80, threshold: 60 }
            );

            // It should flee towards positive X (to the right)
            expect(offset.x).toBeGreaterThan(0);
            // Element center after move:
            const newCenterX = naturalPos.left + offset.x + elSize.width / 2;
            expect(newCenterX).toBeGreaterThan(200);
        });

        it('moves element away from incoming cursor from the top', () => {
            // Button center is at (200, 170). Cursor approaches from top (200, 120)
            const cursor = { x: 200, y: 120 };
            const offset = calculateEvasionOffset(
                cursor,
                elSize,
                naturalPos,
                bounds,
                { x: 0, y: 0 },
                { distance: 80, threshold: 60 }
            );

            // It should flee downwards towards positive Y
            expect(offset.y).toBeGreaterThan(0);
        });

        it('never places element outside container boundaries', () => {
            // Container with tight right wall
            const tightBounds = { left: 100, top: 100, right: 300, bottom: 300 };
            const cornerPos = { left: 180, top: 180 }; // max allowed X offset is 300 - 180 - 100 = 20

            // Cursor pushes directly towards the right wall
            const cursor = { x: 150, y: 200 };
            const offset = calculateEvasionOffset(
                cursor,
                elSize,
                cornerPos,
                tightBounds,
                { x: 0, y: 0 },
                { distance: 100, threshold: 80 }
            );

            const finalLeft = cornerPos.left + offset.x;
            const finalRight = finalLeft + elSize.width;
            const finalTop = cornerPos.top + offset.y;
            const finalBottom = finalTop + elSize.height;

            expect(finalLeft).toBeGreaterThanOrEqual(tightBounds.left);
            expect(finalRight).toBeLessThanOrEqual(tightBounds.right);
            expect(finalTop).toBeGreaterThanOrEqual(tightBounds.top);
            expect(finalBottom).toBeLessThanOrEqual(tightBounds.bottom);
        });

        it('smoothly glides along perimeter when cornered against boundary and escapes cursor', () => {
            // Button trapped in top-left corner
            const tightBounds = { left: 0, top: 0, right: 300, bottom: 200 };
            const origin = { left: 0, top: 0 };
            // Cursor comes directly from inside, trapping button at (0, 0)
            const cursor = { x: 30, y: 30 };

            const offset = calculateEvasionOffset(
                cursor,
                elSize,
                origin,
                tightBounds,
                { x: 0, y: 0 },
                { distance: 80, threshold: 60 }
            );

            // It must glide away from corner rather than freezing
            expect(Math.hypot(offset.x, offset.y)).toBeGreaterThanOrEqual(15);

            const finalCenterX = origin.left + offset.x + elSize.width / 2;
            const finalCenterY = origin.top + offset.y + elSize.height / 2;
            const distFromCursor = Math.hypot(finalCenterX - cursor.x, finalCenterY - cursor.y);

            expect(distFromCursor).toBeGreaterThan(60);
        });

        it('never gets stuck when repeatedly approached in a corner', () => {
            const tightBounds = { left: 0, top: 0, right: 300, bottom: 200 };
            const origin = { left: 0, top: 0 };
            let currentOffset = { x: 0, y: 0 };

            // Approach corner 3 consecutive times; button must escape further each time
            for (let i = 0; i < 3; i++) {
                const btnCenterX = origin.left + currentOffset.x + elSize.width / 2;
                const btnCenterY = origin.top + currentOffset.y + elSize.height / 2;
                // Cursor approaches center
                const cursor = { x: btnCenterX - 10, y: btnCenterY - 10 };

                const nextOffset = calculateEvasionOffset(
                    cursor,
                    elSize,
                    origin,
                    tightBounds,
                    currentOffset,
                    { distance: 60, threshold: 50 }
                );

                const moved = Math.hypot(nextOffset.x - currentOffset.x, nextOffset.y - currentOffset.y);
                expect(moved).toBeGreaterThanOrEqual(15);
                currentOffset = nextOffset;
            }
        });

        it('strictly respects maxRadius limit from home position (0, 0)', () => {
            const largeBounds = { left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000 };
            const centerPos = { left: 500, top: 500 };
            const cursor = { x: 530, y: 530 }; // cursor near center

            const maxRadius = 50;
            const offset = calculateEvasionOffset(
                cursor,
                elSize,
                centerPos,
                largeBounds,
                { x: 0, y: 0 },
                { distance: 200, maxRadius } // raw distance 200 > maxRadius 50
            );

            const r = Math.hypot(offset.x, offset.y);
            expect(r).toBeLessThanOrEqual(maxRadius + 1); // allow rounding tolerance of 1px
        });
    });
});
