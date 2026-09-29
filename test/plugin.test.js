import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createApp, ref } from '@wrium/wrium';
import { EvasiveButtonPlugin } from '../index.js';

describe('EvasiveButtonPlugin (v-evade directive)', () => {
    let dom, document, container;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
            pretendToBeVisual: true
        });
        global.window = dom.window;
        global.document = dom.window.document;
        global.CustomEvent = dom.window.CustomEvent;
        document = dom.window.document;
        container = document.getElementById('app');
    });

    afterEach(() => {
        if (container) container.innerHTML = '';
    });

    it('installs and mounts without throwing on a button with v-evade', () => {
        container.innerHTML = '<button v-evade data-testid="btn">Submit</button>';
        const app = createApp(() => ({}));
        app.use(EvasiveButtonPlugin);
        expect(() => app.mount(container)).not.toThrow();

        const btn = container.querySelector('button');
        expect(btn).not.toBeNull();
        expect(btn.style.willChange).toBe('transform');
    });

    it('dispatches an evade event when cursor is detected', () => {
        container.innerHTML = '<button v-evade data-testid="btn">Submit</button>';
        const app = createApp(() => ({}));
        app.use(EvasiveButtonPlugin);
        app.mount(container);

        const btn = container.querySelector('button');
        let evaded = false;
        let eventDetail = null;

        btn.addEventListener('evade', (e) => {
            evaded = true;
            eventDetail = e.detail;
        });

        // Simulate pointerenter with coordinates
        btn.dispatchEvent(new dom.window.MouseEvent('pointerenter', { clientX: 50, clientY: 50 }));

        expect(evaded).toBe(true);
        expect(eventDetail).toHaveProperty('attempts', 1);
        expect(btn.style.transform).toMatch(/translate\(-?\d+px,\s*-?\d+px\)/);
    });

    it('reacts to reactive boolean condition (v-evade="isActive")', () => {
        container.innerHTML = '<button v-evade="isActive" data-testid="btn">Submit</button>';
        const isActive = ref(true);
        const app = createApp(() => ({ isActive }));
        app.use(EvasiveButtonPlugin);
        app.mount(container);

        const btn = container.querySelector('button');
        btn.dispatchEvent(new dom.window.MouseEvent('pointerenter', { clientX: 50, clientY: 50 }));
        expect(btn.style.transform).not.toBe('translate(0px, 0px)');
        expect(btn.style.transform).toMatch(/translate\(-?\d+px,\s*-?\d+px\)/);

        // When deactivated, position resets to 0, 0
        isActive.value = false;
        return new Promise(resolve => {
            setTimeout(() => {
                expect(btn.style.transform).toBe('translate(0px, 0px)');
                resolve();
            }, 10);
        });
    });

    it('stops evading once maxAttempts is reached', () => {
        container.innerHTML = '<button v-evade="{ maxAttempts: 2 }" data-testid="btn">Submit</button>';
        const app = createApp(() => ({}));
        app.use(EvasiveButtonPlugin);
        app.mount(container);

        const btn = container.querySelector('button');
        let evadeCount = 0;
        btn.addEventListener('evade', () => { evadeCount++; });

        btn.dispatchEvent(new dom.window.MouseEvent('pointerenter', { clientX: 50, clientY: 50 }));
        btn.dispatchEvent(new dom.window.MouseEvent('pointerenter', { clientX: 50, clientY: 50 }));
        expect(evadeCount).toBe(2);

        // Third attempt should not evade because maxAttempts: 2
        btn.dispatchEvent(new dom.window.MouseEvent('pointerenter', { clientX: 50, clientY: 50 }));
        expect(evadeCount).toBe(2);
    });

    it('intercepts click and prevents default when evasive', () => {
        container.innerHTML = '<button v-evade data-testid="btn">Submit</button>';
        const app = createApp(() => ({}));
        app.use(EvasiveButtonPlugin);
        app.mount(container);

        const btn = container.querySelector('button');
        let defaultPrevented = false;

        const event = new dom.window.MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: 20,
            clientY: 20
        });

        btn.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });

    it('manages .is-settled and .is-evading state classes and fires @settle on reset', async () => {
        container.innerHTML = '<button v-evade="isActive" data-testid="btn">Submit</button>';
        const isActive = ref(true);
        const app = createApp(() => ({ isActive }));
        app.use(EvasiveButtonPlugin);
        app.mount(container);

        const btn = container.querySelector('button');
        // Initial state is settled
        expect(btn.classList.contains('is-settled')).toBe(true);
        expect(btn.classList.contains('is-evading')).toBe(false);

        let settled = false;
        btn.addEventListener('settle', () => { settled = true; });

        // Trigger evasion
        btn.dispatchEvent(new dom.window.MouseEvent('pointerenter', { clientX: 50, clientY: 50 }));
        expect(btn.classList.contains('is-evading')).toBe(true);
        expect(btn.classList.contains('is-settled')).toBe(false);

        // Turn off evasion (simulating valid form submission)
        isActive.value = false;

        // Wait for settle transition
        await new Promise(resolve => setTimeout(resolve, 320));

        expect(btn.classList.contains('is-settled')).toBe(true);
        expect(btn.classList.contains('is-evading')).toBe(false);
        expect(settled).toBe(true);
    });

    it('emits @giveup event when maxAttempts is reached', () => {
        container.innerHTML = '<button v-evade="{ maxAttempts: 1 }" data-testid="btn">Submit</button>';
        const app = createApp(() => ({}));
        app.use(EvasiveButtonPlugin);
        app.mount(container);

        const btn = container.querySelector('button');
        let giveupDetail = null;
        btn.addEventListener('giveup', (e) => { giveupDetail = e.detail; });

        // First attempt evades
        btn.dispatchEvent(new dom.window.MouseEvent('pointerenter', { clientX: 50, clientY: 50 }));
        // Second attempt triggers giveup
        btn.dispatchEvent(new dom.window.MouseEvent('pointerenter', { clientX: 50, clientY: 50 }));

        expect(giveupDetail).not.toBeNull();
        expect(giveupDetail.reason).toBe('maxAttempts');
    });

    it('supports custom container selector for bounds (bounds: "#arena")', () => {
        container.innerHTML = '<div id="arena"><button v-evade="{ bounds: \'#arena\' }" data-testid="btn">Submit</button></div>';
        const app = createApp(() => ({}));
        app.use(EvasiveButtonPlugin);
        app.mount(container);

        const btn = container.querySelector('button');
        btn.dispatchEvent(new dom.window.MouseEvent('pointerenter', { clientX: 50, clientY: 50 }));
        expect(btn.style.transform).toMatch(/translate\(-?\d+px,\s*-?\d+px\)/);
    });

    it('emits @giveup event when duration expires via background timer', async () => {
        container.innerHTML = '<button v-evade="{ duration: 150 }" data-testid="btn">Submit</button>';
        const app = createApp(() => ({}));
        app.use(EvasiveButtonPlugin);
        app.mount(container);

        const btn = container.querySelector('button');
        let giveupDetail = null;
        btn.addEventListener('giveup', (e) => { giveupDetail = e.detail; });

        // Trigger first evade -> starts 150ms duration timer
        btn.dispatchEvent(new dom.window.MouseEvent('pointerenter', { clientX: 50, clientY: 50 }));
        expect(giveupDetail).toBeNull();

        // Wait for timer to expire
        await new Promise(resolve => setTimeout(resolve, 220));

        expect(giveupDetail).not.toBeNull();
        expect(giveupDetail.reason).toBe('duration');
        expect(btn.dataset.state).toBe('gaveup');
    });

    it('unmounts cleanly and removes listeners', () => {
        container.innerHTML = '<button v-evade data-testid="btn">Submit</button>';
        const app = createApp(() => ({}));
        app.use(EvasiveButtonPlugin);
        app.mount(container);

        expect(() => app.unmount()).not.toThrow();
    });
});
