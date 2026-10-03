# iPhone immersive canvas

The existing Next static export has no editable React source in this repository.
`iphone-viewport-source.js` is the readable canvas adapter. Regenerate the scoped
export patch with `python3 scripts/update-mimi-viewport.py`. It asserts every
expected original fragment before writing and creates a new content-hashed page
chunk, updating the HTML and RSC references together. The original chunk stays
for cached clients and as the baseline; do not overwrite it.

The iPhone shell opts in with `html.km-mimi` and supplies `--km-safe-top` and
`--km-safe-left` in CSS pixels. Without that class, the existing website layout
and world size remain unchanged. The shell owns the mode-selector visibility.

The canvas backing size follows its displayed bounds, with one uniform scale.
The extra viewport is drawn as continuous sky/terrain rather than CSS margins.
Physics, mode selection, Arabic letters, scores and persistence remain in the
existing game engine. The landscape view reveals more upcoming platforms.
Rotation resizes drawing without resetting the current game. Resize listeners
and the observer are disposed with the React effect.

Validation: JavaScript syntax; local browser portrait 393x852 and landscape
852x393; both modes, start, game-over and restart; ordinary website layout;
iPhone 18 Pro / iOS 27 simulator portrait and landscape with safe-area controls.
