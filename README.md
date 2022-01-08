
# Rust WASM Mandelbrot Fractal Generator

Render an image of the Mandelbrot set in your web browser using WebAssembly.

## Project Motivation

The main goal of this project is to learn about the Rust/WebAssembly ecosystem, multi-threaded web development, and the interaction between the two. A secondary goal is to render beautiful mathematical images.

## Technologies Used

- [Typescript](https://www.typescriptlang.org/) (with [Babel](https://babeljs.io/) and [Webpack 5](https://webpack.js.org/)), employing [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) to enable multi-threading
- [Rust](https://www.rust-lang.org/)/[WebAssembly](https://webassembly.org/) via [`wasm-pack`](https://rustwasm.github.io/) for Mandelbrot calculations and canvas rendering

## Interesting Code

- `render_mandelbrot` (and `draw_pixel`) in `src/lib.rs`:
  - ` render_mandelbrot` is a function that is exposed to the JavaScript engine via WebAssembly
    - in Rust, this is done via the `#[wasm_bindgen]` attribute macro
    - for the `image_data` parameter, accepts a `&mut [u8]` in Rust which is a `Uint8Array` in JavaScript
  - `draw_pixel` directly writes raw canvas image data
- `worker.ts`
  - a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) script
  - since the Mandelbrot equation is [embarrassingly parallelizable](https://en.wikipedia.org/wiki/Embarrassingly_parallel), using multiple threads will help out the performance tremendously
  - data is transferred from worker to main thread through `postMessage`
    - since `ArrayBuffers` are `Transferable`, no copying is done, meaning less overhead

## Disclaimer

This code is mostly just a simple learning exercise. It likely does not follow all the best practices and it certainly contains some sloppy code. Please don't consider this to be a model program. The UI is not great and there is always something that could be improved.

## Contributing

Hate the UI? Find something I did incorrectly? Hate my code style? Send me a message or pull request!

## Setup
- Clone this Git repository (`git clone https://github.com/tobias-hildebrandt/web-fractals.git`)
- Install dependencies 
  - Rust, Node.js, and npm
  - [`wasm-pack`](https://rustwasm.github.io/wasm-pack/installer)
- Build the WASM module (`wasm-pack build`)
  - This will create `pkg/`
- Enter the web directory (`cd www`)
  - Install Node.js dependencies (`npm install --dev`)
  - Run the webpack dev server (`npm start`)
  - Or build it (`npm build`) and serve it over your web server of choice
    - Bundled files will be in `www/dist`

## Possible Future Improvements

- [ ] put on GitHub Pages
- [ ] add benchmarking to show empirical speed improvement of WASM vs JavaScript
  - [ ] include different approaches to array passing
- [ ] improve the UI
  - [ ] responsive web page for mobile devices
  - [ ] better way to represent current status
  - [ ] add interesting bookmarks/waypoints
  - [ ] use React?
  - [ ] interactive map style via Leaflet?
- [ ] more extensive testing
- [ ] switch to GPU-based WebGL rendering instead of CPU-based `2d` context
- [ ] switch to arbitrary-precision decimal when 64 bit floating points becomes too inaccurate (perhaps `bigdecimal` for Rust and `big.js` for JS?)
  - [ ] employ perturbation theory and series approximation for quicker rendering at high bit-length values
- [ ] change coloring algorithm
  - [ ] average color of pixels within the set
  - [ ] smooth coloring
  - [ ] distance estimate
- [ ] add other fractals
  - [ ] Julia set
  - [ ] Burning Ship
  - [ ] Newton

## License
AGPLv3+, see the [LICENSE](/LICENSE) file