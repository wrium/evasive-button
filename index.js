/**
 * Evasive Button Plugin for Wrium.
 *
 * Causes buttons (or any interactive element) to playfully and smoothly dodge the cursor
 * when hovered, approached, or clicked. Ideal for playful login screens,
 * gamified forms, prank pages, or interactive validation feedback.
 *
 * Phase 2 Capabilities:
 * - Fluid tangential gliding and perimeter wall-sliding (no erratic corner teleporting).
 * - Anti-stuck corner escape mechanics (never gets trapped in corners or pinned against walls).
 * - Bounded environment control: 'parent', 'viewport', or custom selector (e.g. bounds: '#arena').
 * - Movement limits:
 *   - maxRadius: limits evasion distance from the button's home anchor.
 *   - duration: timeout in milliseconds after which evasion gives up and settles.
 *   - maxAttempts: count limit after which evasion gives up and settles.
 * - Guaranteed smooth return to default position (0, 0) when disabled or form becomes valid.
 * - Lifecycle state classes (.is-evading, .is-settled) and events (@evade, @settle, @giveup).
 * - Accessibility: prefers-reduced-motion auto-detection and Tab+Enter keyboard support.
 *
 * @example
 * import { createApp, ref, computed } from '@wrium/wrium';
 * import { EvasiveButtonPlugin } from '@wrium/evasive-button';
 *
 * createApp(() => {
 *     const username = ref('');
 *     const password = ref('');
 *     const isFormValid = computed(() => username.value.length >= 3 && password.value.length >= 6);
 *     return { username, password, isFormValid };
 * })
 *     .use(EvasiveButtonPlugin)
 *     .mount('#app');
 *
 * <!-- Evasive until fields are filled, then smoothly glides home and settles -->
 * <button v-evade="{ active: !isFormValid, bounds: '#arena', maxRadius: 150 }" @settle="onSettled">
 *     Log In
 * </button>
 */

/**
 * Check if user's OS has prefers-reduced-motion enabled.
 *
 * @returns {boolean}
 */
export function isReducedMotionPreferred() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
}

/**
 * Check if the cursor is within the proximity threshold of a target bounding rect.
 *
 * @param {{ x: number, y: number }} cursor
 * @param {{ left: number, top: number, width: number, height: number, right?: number, bottom?: number }} targetRect
 * @param {number} threshold
 * @returns {{ isNear: boolean, distance: number, center: { x: number, y: number } }}
 */
export function isNearTarget(cursor, targetRect, threshold = 80) {
    const center = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2
    };

    // Calculate shortest distance from cursor point to element rectangle
    const nearestX = Math.max(targetRect.left, Math.min(cursor.x, targetRect.left + targetRect.width));
    const nearestY = Math.max(targetRect.top, Math.min(cursor.y, targetRect.top + targetRect.height));
    const edgeDist = Math.hypot(cursor.x - nearestX, cursor.y - nearestY);

    return {
        isNear: edgeDist < threshold,
        distance: edgeDist,
        center
    };
}

/**
 * Calculates a new translation offset { x, y } that evades the cursor
 * while staying strictly within the container bounds and respecting maxRadius.
 *
 * Pure function - completely decoupled from DOM mutations for clean testability.
 *
 * @param {{ x: number, y: number }} cursor - Cursor coordinates in viewport space
 * @param {{ width: number, height: number }} elSize - Element dimensions
 * @param {{ left: number, top: number }} naturalPos - Natural element origin (translate = 0)
 * @param {{ left: number, top: number, right: number, bottom: number }} bounds - Allowed boundary box
 * @param {{ x: number, y: number }} currentOffset - Current translation { x, y }
 * @param {Object} [options]
 * @param {number} [options.distance=100] - Base leap distance in pixels
 * @param {number} [options.threshold=80] - Proximity trigger distance in pixels
 * @param {number} [options.maxRadius] - Maximum allowable distance from home origin (0, 0)
 * @param {boolean} [options.random=false] - Apply random angle jitter
 * @returns {{ x: number, y: number, escaped: boolean }}
 */
export function calculateEvasionOffset(
    cursor,
    elSize,
    naturalPos,
    bounds,
    currentOffset = { x: 0, y: 0 },
    options = {}
) {
    const rawDistance = options.distance ?? 100;
    const threshold = options.threshold ?? 80;
    const maxRadius = (typeof options.maxRadius === 'number' && options.maxRadius > 0)
        ? options.maxRadius
        : Infinity;
    const randomJitter = options.random ?? false;

    // Translation limits relative to natural position
    const minX = bounds.left - naturalPos.left;
    const maxX = bounds.right - naturalPos.left - elSize.width;
    const minY = bounds.top - naturalPos.top;
    const maxY = bounds.bottom - naturalPos.top - elSize.height;

    // Safe clamped ranges (handles tight/reversed bounds)
    const safeMinX = Math.min(minX, maxX);
    const safeMaxX = Math.max(minX, maxX);
    const safeMinY = Math.min(minY, maxY);
    const safeMaxY = Math.max(minY, maxY);

    const spanX = safeMaxX - safeMinX;
    const spanY = safeMaxY - safeMinY;

    // Adapt step distance to container dimensions and maxRadius
    const minSpan = Math.min(spanX, spanY);
    const maxSpan = Math.max(spanX, spanY);
    let adaptiveDistance = maxSpan > 0
        ? Math.min(rawDistance, Math.max(30, Math.min(rawDistance, minSpan > 40 ? minSpan * 0.75 : maxSpan * 0.6)))
        : 0;

    if (maxRadius !== Infinity) {
        adaptiveDistance = Math.min(adaptiveDistance, maxRadius * 0.8);
    }

    // Current visual center
    const currentCenter = {
        x: naturalPos.left + currentOffset.x + elSize.width / 2,
        y: naturalPos.top + currentOffset.y + elSize.height / 2
    };

    // Vector pointing away from cursor towards element center
    let vx = currentCenter.x - cursor.x;
    let vy = currentCenter.y - cursor.y;
    let d = Math.hypot(vx, vy);

    if (d === 0) {
        vx = (Math.random() - 0.5) || 1;
        vy = (Math.random() - 0.5) || 1;
        d = Math.hypot(vx, vy);
    }

    let ux = vx / d;
    let uy = vy / d;

    if (randomJitter) {
        const jitterAngle = (Math.random() - 0.5) * (Math.PI / 4);
        const cosJ = Math.cos(jitterAngle);
        const sinJ = Math.sin(jitterAngle);
        const nux = ux * cosJ - uy * sinJ;
        const nuy = ux * sinJ + uy * cosJ;
        ux = nux;
        uy = nuy;
    }

    // Step 1: Direct Flee with Tangential Deflection (Wall Sliding)
    const stepX = ux * adaptiveDistance;
    const stepY = uy * adaptiveDistance;

    let targetX = currentOffset.x + stepX;
    let targetY = currentOffset.y + stepY;

    // Boundary collision handling: deflect overflow into sliding along the open wall
    if (targetX > safeMaxX) {
        const overflow = targetX - safeMaxX;
        targetX = safeMaxX;
        const dirY = uy !== 0 ? Math.sign(uy) : (currentCenter.y >= cursor.y ? 1 : -1);
        targetY += dirY * overflow * 0.85;
    } else if (targetX < safeMinX) {
        const overflow = safeMinX - targetX;
        targetX = safeMinX;
        const dirY = uy !== 0 ? Math.sign(uy) : (currentCenter.y >= cursor.y ? 1 : -1);
        targetY += dirY * overflow * 0.85;
    }

    if (targetY > safeMaxY) {
        const overflow = targetY - safeMaxY;
        targetY = safeMaxY;
        const dirX = ux !== 0 ? Math.sign(ux) : (currentCenter.x >= cursor.x ? 1 : -1);
        targetX += dirX * overflow * 0.85;
    } else if (targetY < safeMinY) {
        const overflow = safeMinY - targetY;
        targetY = safeMinY;
        const dirX = ux !== 0 ? Math.sign(ux) : (currentCenter.x >= cursor.x ? 1 : -1);
        targetX += dirX * overflow * 0.85;
    }

    // Apply maxRadius constraint from natural origin (0, 0)
    if (maxRadius !== Infinity) {
        const distFromOrigin = Math.hypot(targetX, targetY);
        if (distFromOrigin > maxRadius) {
            const scale = maxRadius / distFromOrigin;
            targetX *= scale;
            targetY *= scale;
        }
    }

    // Ensure within boundary limits
    targetX = Math.max(safeMinX, Math.min(safeMaxX, targetX));
    targetY = Math.max(safeMinY, Math.min(safeMaxY, targetY));

    // Step 2: Anti-Stuck Corner Escape
    // If trapped in a corner or pinned against a wall (effective displacement < 15px),
    // evaluate smooth sliding paths along open perimeter walls rather than freezing or teleporting.
    const moveDist = Math.hypot(targetX - currentOffset.x, targetY - currentOffset.y);

    if (moveDist < 15 && (spanX > 0 || spanY > 0)) {
        const escapeCandidates = [];

        // Slide horizontally along wall
        if (spanX > 0) {
            escapeCandidates.push({
                x: Math.max(safeMinX, Math.min(safeMaxX, currentOffset.x + adaptiveDistance)),
                y: currentOffset.y
            });
            escapeCandidates.push({
                x: Math.max(safeMinX, Math.min(safeMaxX, currentOffset.x - adaptiveDistance)),
                y: currentOffset.y
            });
        }

        // Slide vertically along wall
        if (spanY > 0) {
            escapeCandidates.push({
                x: currentOffset.x,
                y: Math.max(safeMinY, Math.min(safeMaxY, currentOffset.y + adaptiveDistance))
            });
            escapeCandidates.push({
                x: currentOffset.x,
                y: Math.max(safeMinY, Math.min(safeMaxY, currentOffset.y - adaptiveDistance))
            });
        }

        // Diagonal perimeter glides away from corner
        if (spanX > 0 && spanY > 0) {
            escapeCandidates.push({
                x: Math.max(safeMinX, Math.min(safeMaxX, currentOffset.x + adaptiveDistance * 0.7)),
                y: Math.max(safeMinY, Math.min(safeMaxY, currentOffset.y + adaptiveDistance * 0.7))
            });
            escapeCandidates.push({
                x: Math.max(safeMinX, Math.min(safeMaxX, currentOffset.x - adaptiveDistance * 0.7)),
                y: Math.max(safeMinY, Math.min(safeMaxY, currentOffset.y - adaptiveDistance * 0.7))
            });
            escapeCandidates.push({
                x: Math.max(safeMinX, Math.min(safeMaxX, currentOffset.x + adaptiveDistance * 0.7)),
                y: Math.max(safeMinY, Math.min(safeMaxY, currentOffset.y - adaptiveDistance * 0.7))
            });
            escapeCandidates.push({
                x: Math.max(safeMinX, Math.min(safeMaxX, currentOffset.x - adaptiveDistance * 0.7)),
                y: Math.max(safeMinY, Math.min(safeMaxY, currentOffset.y + adaptiveDistance * 0.7))
            });
        }

        let bestCandidate = null;
        let maxCandidateDist = -Infinity;

        for (const cand of escapeCandidates) {
            // Apply maxRadius constraint to candidate
            if (maxRadius !== Infinity) {
                const candR = Math.hypot(cand.x, cand.y);
                if (candR > maxRadius) {
                    cand.x *= maxRadius / candR;
                    cand.y *= maxRadius / candR;
                }
            }

            cand.x = Math.max(safeMinX, Math.min(safeMaxX, cand.x));
            cand.y = Math.max(safeMinY, Math.min(safeMaxY, cand.y));

            const candMoveDist = Math.hypot(cand.x - currentOffset.x, cand.y - currentOffset.y);
            if (candMoveDist >= 15) {
                const candCenter = {
                    x: naturalPos.left + cand.x + elSize.width / 2,
                    y: naturalPos.top + cand.y + elSize.height / 2
                };
                const distFromCursor = Math.hypot(candCenter.x - cursor.x, candCenter.y - cursor.y);
                if (distFromCursor > maxCandidateDist) {
                    maxCandidateDist = distFromCursor;
                    bestCandidate = cand;
                }
            }
        }

        if (bestCandidate) {
            targetX = bestCandidate.x;
            targetY = bestCandidate.y;
        }
    }

    const finalCenter = {
        x: naturalPos.left + targetX + elSize.width / 2,
        y: naturalPos.top + targetY + elSize.height / 2
    };
    const finalDistFromCursor = Math.hypot(finalCenter.x - cursor.x, finalCenter.y - cursor.y);

    return {
        x: Math.round(targetX),
        y: Math.round(targetY),
        escaped: finalDistFromCursor >= threshold
    };
}

/**
 * Resolve the bounding box to constrain element movement within.
 *
 * @param {HTMLElement} el
 * @param {'parent'|'viewport'|string} [boundsType='parent']
 * @returns {{ left: number, top: number, right: number, bottom: number, width: number, height: number }}
 */
export function getBoundingContainer(el, boundsType = 'parent') {
    const defaultW = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1024;
    const defaultH = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 768;

    if (boundsType === 'viewport' || typeof window === 'undefined') {
        const padding = 12;
        return {
            left: padding,
            top: padding,
            right: defaultW - padding,
            bottom: defaultH - padding,
            width: defaultW - 2 * padding,
            height: defaultH - 2 * padding
        };
    }

    let container = null;
    if (typeof boundsType === 'string' && boundsType !== 'parent') {
        container = document.querySelector(boundsType);
    }
    if (!container) {
        container = el.offsetParent || el.parentElement || document.body;
    }

    const r = container ? container.getBoundingClientRect() : { left: 0, top: 0, right: defaultW, bottom: defaultH };
    const w = (container ? container.clientWidth : 0) || r.width || defaultW;
    const h = (container ? container.clientHeight : 0) || r.height || defaultH;

    // Safety margin inside container so the button never clips borders
    const pad = 6;
    return {
        left: (r.left || 0) + pad,
        top: (r.top || 0) + pad,
        right: (r.right || (r.left + w)) - pad,
        bottom: (r.bottom || (r.top + h)) - pad,
        width: Math.max(0, w - 2 * pad),
        height: Math.max(0, h - 2 * pad)
    };
}

/**
 * Creates the directive handler for `v-evade` / `v-evasive`.
 */
function createEvadeDirective(pluginOptions = {}) {
    return (el, exp, { scope, cs, evalExp, watchEffect, arg, modifiers }) => {
        let attempts = 0;
        let currentTranslate = { x: 0, y: 0 };
        let naturalRect = null;
        let lastEvadeTime = 0;
        let evasionStartTime = null;
        let hasGivenUp = false;
        let settleTimer = null;
        const COOLDOWN_MS = 130; // Minimum time between proximity triggers for smooth fluid motion

        const isTeleport = modifiers.teleport || pluginOptions.teleport;
        // Fluid, natural easing curve
        const transitionDuration = isTeleport ? 0 : 280;
        const transitionStyle = isTeleport
            ? 'none'
            : `transform ${transitionDuration / 1000}s cubic-bezier(0.25, 1, 0.5, 1)`;

        el.style.willChange = 'transform';
        el.style.transition = transitionStyle;

        // Initial state
        function setButtonState(state) {
            el.dataset.state = state;
            el.dataset.evading = state === 'evading' ? 'true' : 'false';
            if (state === 'evading') {
                el.classList.add('is-evading');
                el.classList.remove('is-settled');
            } else if (state === 'settled') {
                el.classList.remove('is-evading');
                el.classList.add('is-settled');
            } else if (state === 'gaveup') {
                el.classList.remove('is-evading');
                el.classList.add('is-settled');
            }
        }

        setButtonState('settled');

        function resolveContainerElement() {
            if (config.bounds === 'viewport') return null;
            if (typeof config.bounds === 'string' && config.bounds !== 'parent') {
                const found = document.querySelector(config.bounds);
                if (found) return found;
            }
            return el.offsetParent || el.parentElement || document.body;
        }

        // Measure natural position dynamically without layout shift or scroll drift
        function getNaturalPosition() {
            const currentW = el.offsetWidth || (naturalRect ? naturalRect.width : 100);
            const currentH = el.offsetHeight || (naturalRect ? naturalRect.height : 36);
            const containerEl = resolveContainerElement();

            if (containerEl && containerEl !== document.body) {
                const cRect = containerEl.getBoundingClientRect();
                let ox = 0;
                let oy = 0;
                let curr = el;
                while (curr && curr !== containerEl && curr !== document.body) {
                    ox += curr.offsetLeft || 0;
                    oy += curr.offsetTop || 0;
                    curr = curr.offsetParent;
                }
                naturalRect = {
                    left: cRect.left + ox,
                    top: cRect.top + oy,
                    width: currentW,
                    height: currentH
                };
                return naturalRect;
            }

            // Fallback for viewport or document.body
            const r = el.getBoundingClientRect();
            naturalRect = {
                left: r.left - currentTranslate.x,
                top: r.top - currentTranslate.y,
                width: currentW,
                height: currentH
            };
            return naturalRect;
        }

        // Configuration resolution (reactively updated if expression is used)
        let active = true;
        let config = {
            threshold: pluginOptions.threshold ?? 75,
            distance: pluginOptions.distance ?? 100,
            maxRadius: pluginOptions.maxRadius ?? Infinity,
            duration: pluginOptions.duration ?? Infinity,
            bounds: arg || pluginOptions.bounds || (modifiers.viewport ? 'viewport' : 'parent'),
            random: modifiers.random || pluginOptions.random || false,
            maxAttempts: pluginOptions.maxAttempts ?? Infinity,
            allowKeyboard: pluginOptions.allowKeyboard ?? true,
            respectReducedMotion: pluginOptions.respectReducedMotion ?? true,
            onEvade: null,
            onSettle: null,
            onGiveup: null
        };

        // Smooth return to default (0, 0) position with .is-settled state
        function resetPosition(reason = 'disabled') {
            currentTranslate = { x: 0, y: 0 };
            el.style.transition = transitionStyle;
            el.style.transform = 'translate(0px, 0px)';

            if (settleTimer) clearTimeout(settleTimer);
            settleTimer = setTimeout(() => {
                if (hasGivenUp) {
                    setButtonState('gaveup');
                } else {
                    setButtonState('settled');
                }

                if (typeof config.onSettle === 'function') {
                    config.onSettle({ attempts, reason });
                }

                el.dispatchEvent(
                    new CustomEvent('settle', {
                        bubbles: true,
                        cancelable: true,
                        detail: { attempts, reason }
                    })
                );
            }, transitionDuration);
        }

        let durationTimer = null;

        function startDurationTimer() {
            clearDurationTimer();
            if (config.duration === Infinity || !active || hasGivenUp) return;

            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (evasionStartTime === null) {
                evasionStartTime = now;
            }
            const elapsed = now - evasionStartTime;
            const remaining = Math.max(0, config.duration - elapsed);

            durationTimer = setTimeout(() => {
                durationTimer = null;
                if (active && !hasGivenUp) {
                    triggerGiveup('duration');
                }
            }, remaining);
        }

        function clearDurationTimer() {
            if (durationTimer) {
                clearTimeout(durationTimer);
                durationTimer = null;
            }
        }

        function triggerGiveup(reason) {
            clearDurationTimer();
            hasGivenUp = true;
            setButtonState('gaveup');

            if (typeof config.onGiveup === 'function') {
                config.onGiveup({ reason, attempts });
            }

            el.dispatchEvent(
                new CustomEvent('giveup', {
                    bubbles: true,
                    cancelable: true,
                    detail: { reason, attempts }
                })
            );

            resetPosition(reason);
        }

        let previousDuration = config.duration;
        let lastResetKey = undefined;

        // Handle expression binding (boolean flag, config object, or ref)
        if (exp && exp.trim()) {
            cs.addEffect(watchEffect(() => {
                const val = evalExp(exp, scope);

                if (typeof val === 'boolean') {
                    active = val;
                } else if (typeof val === 'number') {
                    active = true;
                } else if (val && typeof val === 'object') {
                    if ('active' in val) active = Boolean(val.active);
                    if ('threshold' in val) config.threshold = val.threshold;
                    if ('distance' in val) config.distance = val.distance;
                    if ('maxRadius' in val) config.maxRadius = val.maxRadius;
                    if ('duration' in val) config.duration = val.duration;
                    if ('bounds' in val) config.bounds = val.bounds;
                    if ('random' in val) config.random = Boolean(val.random);
                    if ('maxAttempts' in val) config.maxAttempts = val.maxAttempts;
                    if ('allowKeyboard' in val) config.allowKeyboard = Boolean(val.allowKeyboard);
                    if ('respectReducedMotion' in val) config.respectReducedMotion = Boolean(val.respectReducedMotion);
                    if ('onEvade' in val) config.onEvade = val.onEvade;
                    if ('onSettle' in val) config.onSettle = val.onSettle;
                    if ('onGiveup' in val) config.onGiveup = val.onGiveup;

                    // Manual reset trigger via resetKey
                    if ('resetKey' in val && val.resetKey !== lastResetKey) {
                        lastResetKey = val.resetKey;
                        clearDurationTimer();
                        evasionStartTime = null;
                        hasGivenUp = false;
                        attempts = 0;
                        setButtonState('settled');
                    }
                } else {
                    active = Boolean(val);
                }

                // If duration configuration changed, reset timer state
                if (config.duration !== previousDuration) {
                    previousDuration = config.duration;
                    clearDurationTimer();
                    evasionStartTime = null;
                    hasGivenUp = false;
                    attempts = 0;
                    setButtonState('settled');
                }

                // If active toggled from false back to true, reset given-up state
                if (active) {
                    if (hasGivenUp) {
                        hasGivenUp = false;
                        evasionStartTime = null;
                        attempts = 0;
                    }
                } else {
                    clearDurationTimer();
                    resetPosition('disabled');
                }
            }));
        }

        function triggerEvade(cursor, source = 'proximity') {
            if (!active || hasGivenUp) return false;

            // Accessibility: Respect prefers-reduced-motion
            if (config.respectReducedMotion && isReducedMotionPreferred()) {
                return false;
            }

            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

            // Track duration limit with active timer
            if (config.duration !== Infinity) {
                if (evasionStartTime === null) {
                    evasionStartTime = now;
                    startDurationTimer();
                } else if (now - evasionStartTime >= config.duration) {
                    triggerGiveup('duration');
                    return false;
                }
            }

            // Track maxAttempts limit
            if (attempts >= config.maxAttempts) {
                triggerGiveup('maxAttempts');
                return false;
            }

            // Proximity triggers respect cooldown to allow transitions to complete smoothly
            if (source === 'proximity' && (now - lastEvadeTime < COOLDOWN_MS)) {
                return false;
            }

            const nat = getNaturalPosition();
            const container = getBoundingContainer(el, config.bounds);

            const safeCursor = {
                x: (cursor && typeof cursor.x === 'number' && !isNaN(cursor.x))
                    ? cursor.x
                    : (nat.left + currentTranslate.x + nat.width / 2),
                y: (cursor && typeof cursor.y === 'number' && !isNaN(cursor.y))
                    ? cursor.y
                    : (nat.top + currentTranslate.y + nat.height / 2)
            };

            const nextOffset = calculateEvasionOffset(
                safeCursor,
                { width: nat.width, height: nat.height },
                { left: nat.left, top: nat.top },
                container,
                currentTranslate,
                {
                    distance: config.distance,
                    threshold: config.threshold,
                    maxRadius: config.maxRadius,
                    random: config.random
                }
            );

            // Calculate actual displacement. If button cannot move further away (blocked/at limit), do nothing
            const moveDelta = Math.hypot(nextOffset.x - currentTranslate.x, nextOffset.y - currentTranslate.y);
            if (moveDelta < 4) {
                return false;
            }

            lastEvadeTime = now;
            const dx = nextOffset.x - currentTranslate.x;
            const dy = nextOffset.y - currentTranslate.y;
            currentTranslate = { x: nextOffset.x, y: nextOffset.y };
            attempts++;

            // Update state
            setButtonState('evading');

            el.style.transition = transitionStyle;
            el.style.transform = `translate(${nextOffset.x}px, ${nextOffset.y}px)`;

            // Update write-back ref if expression points directly to a ref holding attempts
            const targetRef = scope[exp];
            if (targetRef && targetRef._isRef && typeof targetRef.value === 'number') {
                targetRef.value = attempts;
            }

            const eventDetail = {
                attempts,
                x: nextOffset.x,
                y: nextOffset.y,
                dx,
                dy,
                source
            };

            if (typeof config.onEvade === 'function') {
                config.onEvade(eventDetail);
            }

            // Dispatch custom evade event
            el.dispatchEvent(
                new CustomEvent('evade', {
                    bubbles: true,
                    cancelable: true,
                    detail: eventDetail
                })
            );

            return true;
        }

        // Pointer proximity detection with zero layout thrashing
        const onPointerMove = e => {
            if (!active || hasGivenUp) return;

            const cx = typeof e.clientX === 'number' ? e.clientX : 0;
            const cy = typeof e.clientY === 'number' ? e.clientY : 0;

            const nat = getNaturalPosition();
            const currentRect = {
                left: nat.left + currentTranslate.x,
                top: nat.top + currentTranslate.y,
                width: nat.width,
                height: nat.height,
                right: nat.left + currentTranslate.x + nat.width,
                bottom: nat.top + currentTranslate.y + nat.height
            };

            const { isNear } = isNearTarget(
                { x: cx, y: cy },
                currentRect,
                config.threshold
            );

            if (isNear) {
                triggerEvade({ x: cx, y: cy }, 'proximity');
            }
        };

        // Pointer enter (cursor flicked fast into element)
        const onPointerEnter = e => {
            if (!active || hasGivenUp) return;
            const cx = typeof e.clientX === 'number' ? e.clientX : undefined;
            const cy = typeof e.clientY === 'number' ? e.clientY : undefined;
            triggerEvade({ x: cx, y: cy }, 'enter');
        };

        // Intercept mouse click / pointerdown attempts
        const onPointerDown = e => {
            if (!active || hasGivenUp) return;

            if (e.pointerType === 'mouse' || e.pointerType === 'touch' || e.pointerType === 'pen' || e.clientX !== 0 || e.clientY !== 0) {
                e.preventDefault();
                e.stopPropagation();
                const cx = typeof e.clientX === 'number' ? e.clientX : undefined;
                const cy = typeof e.clientY === 'number' ? e.clientY : undefined;
                triggerEvade({ x: cx, y: cy }, 'click_attempt');
            }
        };

        const onClick = e => {
            if (!active || hasGivenUp) return;

            // Synthetic click triggered with mouse cursor
            if (e.clientX !== 0 || e.clientY !== 0 || e.detail > 0) {
                if (e.pointerType !== '') {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerEvade({ x: e.clientX, y: e.clientY }, 'click_attempt');
                }
            } else if (!config.allowKeyboard) {
                e.preventDefault();
                e.stopPropagation();
                const rect = el.getBoundingClientRect();
                triggerEvade({ x: rect.left, y: rect.top }, 'keyboard_attempt');
            }
        };

        const onResize = () => {
            naturalRect = null;
        };

        // Attach listeners with automatic scope cleanup
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        el.addEventListener('pointerenter', onPointerEnter);
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('click', onClick);
        window.addEventListener('resize', onResize);

        cs.addListener(window, 'pointermove', onPointerMove);
        cs.addListener(el, 'pointerenter', onPointerEnter);
        cs.addListener(el, 'pointerdown', onPointerDown);
        cs.addListener(el, 'click', onClick);
        cs.addListener(window, 'resize', onResize);
    };
}

/**
 * EvasiveButtonPlugin definition for Wrium.
 */
export const EvasiveButtonPlugin = {
    install(api, options = {}) {
        const handler = createEvadeDirective(options);
        api.directive('evade', handler);
        api.directive('evasive', handler);
    }
};

/**
 * Convenient aliases
 */
export const EvadePlugin = EvasiveButtonPlugin;
export const EvasivePlugin = EvasiveButtonPlugin;
export default EvasiveButtonPlugin;
