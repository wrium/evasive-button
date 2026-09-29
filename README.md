<p align="center">
  <img src="./assets/evasive-button.png" alt="Wrium Evasive Button logo" width="200" />
</p>

# Wrium Evasive Button

A fun, highly practical plugin for [Wrium](https://github.com/wrium/wrium) that makes buttons (or any interactive element) playfully and smoothly dodge the user's cursor when approached, hovered, or clicked.

Ideal for gamified forms, smart validation ("complete fields to unlock button"), interactive confirmations, or playful login screens!

---

## Highlights

- 🏃 **Smooth Tangential Gliding**: Physics-based wall-sliding that avoids erratic jumps, teleportation, or sticking against boundaries.
- 📐 **Boundary & Arena Control**: Confine movement to `'parent'`, `'viewport'`, or any custom CSS selector (`bounds: '#arena'`).
- 🎯 **Movement Limits**:
  - `maxRadius`: Restrict evasion distance from the button's home anchor so it stays in its neighborhood.
  - `duration`: Auto-timeout (in milliseconds) after which the button gives up and settles.
  - `maxAttempts`: Auto-settle after a maximum number of dodge attempts.
- 🔄 **Form Validation / Reactive Toggles**: Bind directly to expressions like `v-evade="{ active: !isFormValid }"`. When valid, the button smoothly glides home to `(0, 0)`!
- 🎨 **State Classes & Attributes**: Automatically manages `.is-settled`, `.is-evading`, and `data-state="settled|evading|gaveup"` for styling.
- 🔔 **Rich Lifecycle Events**: `@evade`, `@settle`, and `@giveup` DOM events.
- ♿ **Accessible by Design**: Respects `prefers-reduced-motion` and preserves keyboard navigation (`Tab` + `Enter`/`Space`).
- ⚡ **Minimalist**: Zero dependencies, GPU-accelerated transforms, ~1.5 KB.

---

## Installation

```bash
npm install @wrium/evasive-button
# or
bun add @wrium/evasive-button
```

`@wrium/wrium` is a peer dependency — install it too if you haven't already.

---

## Quick Start

### Basic Usage

```html
<div id="app">
    <button v-evade>Try to Click Me!</button>
</div>

<script type="module">
    import { createApp } from '@wrium/wrium';
    import { EvasiveButtonPlugin } from '@wrium/evasive-button';

    createApp(() => ({}))
        .use(EvasiveButtonPlugin)
        .mount('#app');
</script>
```

---

## Practical Form Validation Scenario

The button evades the cursor while required fields are incomplete; as soon as the form is valid, it stops evading and smoothly returns to its default position, ready to be clicked!

```html
<div id="app" class="login-card">
    <h2>Secure Login</h2>

    <input type="text" v-model="username" placeholder="Username (3+ chars)" />
    <input type="password" v-model="password" placeholder="Password (6+ chars)" />

    <!-- Evasion container arena -->
    <div id="button-arena" class="arena">
        <button
            type="submit"
            class="login-btn"
            v-evade="{
                active: !isFormValid,
                bounds: '#button-arena',
                maxRadius: 150,
                threshold: 75,
                duration: 10000
            }"
            @settle="onButtonSettled"
            @evade="onButtonEvaded"
        >
            {{ isFormValid ? 'Log In' : 'Fill fields first!' }}
        </button>
    </div>
</div>

<script type="module">
    import { createApp, ref, computed } from '@wrium/wrium';
    import { EvasiveButtonPlugin } from '@wrium/evasive-button';

    createApp(() => {
        const username = ref('');
        const password = ref('');

        const isFormValid = computed(() => {
            return username.value.trim().length >= 3 && password.value.length >= 6;
        });

        function onButtonSettled(e) {
            console.log('Button has returned home and settled!', e.detail);
        }

        function onButtonEvaded(e) {
            console.log('Button evaded, total attempts:', e.detail.attempts);
        }

        return { username, password, isFormValid, onButtonSettled, onButtonEvaded };
    })
        .use(EvasiveButtonPlugin)
        .mount('#app');
</script>
```

---

## Directive Options Reference

Options can be passed directly as an object to `v-evade="{ ... }"` or globally when installing via `app.use(EvasiveButtonPlugin, { ... })`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `active` | `boolean` | `true` | When `false`, evasion stops and the button smoothly returns to `(0, 0)` |
| `bounds` | `string` | `'parent'` | Bounding container: `'parent'`, `'viewport'`, or a CSS selector (e.g. `'#arena'`) |
| `maxRadius` | `number` | `Infinity` | Maximum radius (in pixels) the button is allowed to stray from its natural anchor |
| `duration` | `number` | `Infinity` | Maximum time (in ms) to evade before giving up and settling |
| `maxAttempts` | `number` | `Infinity` | Maximum number of dodges before giving up and settling |
| `threshold` | `number` | `75` | Proximity trigger distance (in pixels) from the cursor |
| `distance` | `number` | `100` | Base leap distance (in pixels) away from the cursor |
| `random` | `boolean` | `false` | Adds angular jitter to evasion trajectories |
| `teleport` | `boolean` | `false` | Jump instantly without smooth CSS transition animation |
| `allowKeyboard` | `boolean` | `true` | Allows keyboard users (`Tab` + `Enter`/`Space`) to submit without triggering evasion |
| `respectReducedMotion` | `boolean` | `true` | Automatically disables evasion if OS `prefers-reduced-motion` is active |

---

## State Classes & Attributes

The directive automatically maintains CSS classes and data attributes on the element, making visual styling effortless:

- **`.is-settled`** / **`data-state="settled"`**: Present when the button is at rest at its natural origin.
- **`.is-evading`** / **`data-state="evading"`**: Present while the button is actively evading or displaced.
- **`data-state="gaveup"`**: Present when evasion stopped due to `duration` timeout or `maxAttempts`.

### Styling Example:
```css
/* Normal state */
.login-btn.is-settled {
    background: #0284c7;
}

/* While dodging the cursor */
.login-btn.is-evading {
    background: #e11d48;
    box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);
}
```

---

## Lifecycle Events

Elements dispatch custom DOM events that can be listened to via `@event` in Wrium templates:

### `@evade`
Fires on each evasion:
```ts
e.detail: {
    attempts: number, // Total number of evasions triggered
    x: number,        // Current translation X in px
    y: number,        // Current translation Y in px
    dx: number,       // Delta X moved this step
    dy: number,       // Delta Y moved this step
    source: string    // 'proximity' | 'enter' | 'click_attempt'
}
```

### `@settle`
Fires when evasion stops and the button has smoothly landed back at `(0, 0)`:
```ts
e.detail: {
    attempts: number,
    reason: string    // 'disabled' | 'duration' | 'maxAttempts'
}
```

### `@giveup`
Fires when evasion automatically stops because `duration` or `maxAttempts` was reached:
```ts
e.detail: {
    attempts: number,
    reason: string    // 'duration' | 'maxAttempts'
}
```

---

## Standalone Helper Functions

Pure mathematical functions exported for standalone use outside of DOM bindings:

```js
import { calculateEvasionOffset, isNearTarget, isReducedMotionPreferred } from '@wrium/evasive-button';

// Check proximity
const { isNear, distance } = isNearTarget(cursor, targetRect, 80);

// Calculate next offset respecting boundaries and maxRadius
const nextOffset = calculateEvasionOffset(
    cursor,
    elSize,
    naturalPos,
    containerBounds,
    currentOffset,
    { distance: 100, threshold: 80, maxRadius: 150 }
);
```

---

## Testing

Run unit tests (Vitest):
```bash
bun run test
# or: npm test
```

Run End-to-End tests (Playwright):
```bash
bun run test:e2e
# or: npm run test:e2e
```

Interactive UI Test Mode:
```bash
bun run test:e2e:ui
```

---

## License

MIT License.
