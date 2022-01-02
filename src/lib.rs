use std::fmt::Display;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

macro_rules! log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into())
    }
}

#[wasm_bindgen]
pub fn init() {
    set_panic_hook();
    log!("wasm init");
}

fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn mandlebrot(real: f64, imaginary: f64, max_iterations: u32) -> JsValue {
    let m = check_in_mandlebrot(real, imaginary, max_iterations);
    match m {
        Some(iter) => return JsValue::from_f64(iter.into()),
        None => return JsValue::NULL,
    }
}

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct Pixel {
    pub x: u32,
    pub y: u32,
}

#[wasm_bindgen]
impl Pixel {
    #[wasm_bindgen(constructor)]
    pub fn new(x: u32, y: u32) -> Self {
        return Pixel { x, y };
    }

    #[wasm_bindgen(js_name = "toString")]
    pub fn to_string(&self) -> String {
        return format!("{}", self).into();
    }
}

impl Display for Pixel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        return write!(f, "({}, {})", self.x, self.y);
    }
}

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct Complex {
    pub real: f64,
    pub imag: f64,
}

#[wasm_bindgen(js_class = "Complex")]
impl Complex {
    #[wasm_bindgen(constructor)]
    pub fn new(real: f64, imag: f64) -> Self {
        return Complex { real, imag };
    }

    #[wasm_bindgen(js_name = "toString")]
    pub fn to_string(&self) -> String {
        return format!("{}", self).into();
    }
}

impl Display for Complex {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        return write!(f, "{} + {}i", self.real, self.imag);
    }
}

// TODO: put image data into an array, pass the pointer to JS
#[wasm_bindgen]
pub fn mandlebrot_range(
    _lowest: Complex,
    _highest: Complex,
    _image_width: u32,
    _image_height: u32,
) -> js_sys::Uint8Array {
    let array = [1, 2, 3, 4, 5];

    unsafe {
        return js_sys::Uint8Array::view(&array);
    }
}

#[wasm_bindgen]
pub fn uint8array(len: usize) -> js_sys::Uint8Array {
    let mut array = vec![0; len];

    for i in 0..len {
        array[i] = i as u8;
    }

    unsafe {
        return js_sys::Uint8Array::view(&array);
    }
}

#[wasm_bindgen]
pub struct PointerStruct {
    v: Vec<u8>,
}

#[wasm_bindgen]
impl PointerStruct {
    #[wasm_bindgen(constructor)]
    pub fn new(len: usize) -> Self {
        let mut array = vec![0; len];

        for i in 0..len {
            array[i] = i as u8;
        }

        return PointerStruct { v: array };
    }

    pub fn u8pointer(self) -> *const u8 {
        return self.v.as_ptr();
    }
}

// if the number is in the mandlebrot set, returns None
// else, returns how many iterations it took for the cycle to leave the set
pub fn check_in_mandlebrot(real: f64, imaginary: f64, max_iterations: u32) -> Option<u32> {
    let mut x: f64 = 0f64;
    let mut y: f64 = 0f64;
    let mut x_sq: f64 = 0f64;
    let mut y_sq: f64 = 0f64;
    let mut iterations: u32 = 0;

    while x_sq + y_sq <= 4f64 && iterations < max_iterations {
        y = (x + x) * y + imaginary;
        x = x_sq - y_sq + real;
        x_sq = x * x;
        y_sq = y * y;
        iterations += 1;
    }

    if iterations >= max_iterations {
        return None;
    } else {
        return Some(iterations);
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct MandlebrotArgs {
    pub start: Complex,
    pub end: Complex,
    pub width: u32,
    pub height: u32,
    #[wasm_bindgen(js_name = "maxIterations")]
    pub max_iterations: u32,
    #[wasm_bindgen(js_name = "keepRatio")]
    pub keep_ratio: bool,
}

#[wasm_bindgen]
impl MandlebrotArgs {
    #[wasm_bindgen(constructor)]
    pub fn new(
        start: Complex,
        end: Complex,
        width: u32,
        height: u32,
        max_iterations: u32,
        keep_ratio: bool,
    ) -> Self {
        return MandlebrotArgs {
            start,
            end,
            width,
            height,
            max_iterations,
            keep_ratio,
        };
    }
}

#[wasm_bindgen]
impl MandlebrotArgs {
    #[wasm_bindgen(method)]
    pub fn cloned(&self) -> Self {
        return self.clone();
    }
}

// returns lowest number of iterations needed
#[wasm_bindgen]
pub async fn render_mandlebrot(
    image_data: js_sys::Uint8ClampedArray,
    results: js_sys::Int32Array,
    args: MandlebrotArgs,
    start_index: u32,
    amount: u32,
) -> Option<u32> {
    let mut count: u32 = 0;
    let mut pixel: Pixel = index_to_pixel(start_index, &args);
    let mut lowest_iterations: Option<u32> = None;
    let mut result: Option<u32>;

    // log!(
    //     "start: {} , end: {}, size: {} x {}, iter: {}, start_index: {} {}, amount: {}",
    //     args.start,
    //     args.end,
    //     args.width,
    //     args.height,
    //     args.max_iterations,
    //     start_index,
    //     pixel,
    //     amount,
    // );

    loop {
        let complex = pixel_to_complex(&pixel, &args);

        result = check_in_mandlebrot(complex.real, complex.imag, args.max_iterations);

        match result {
            Some(unsigned) => {
                if lowest_iterations == None {
                    lowest_iterations = Some(unsigned);
                }

                if let Some(current_low) = lowest_iterations {
                    if unsigned < current_low {
                        lowest_iterations = Some(unsigned);
                    }
                }

                let signed = unsigned as i32;
                results.set_index(start_index + count, signed);
            }
            None => {
                results.set_index(start_index + count, -1i32);
            }
        }

        draw_pixel(&pixel, result, &args, &image_data);

        if count >= amount {
            // log!("done after {}, count is {}", pixel, count);
            break;
        } else {
            count += 1;

            pixel = index_to_pixel(count + start_index, &args);
        }
    }

    return lowest_iterations;
}

#[wasm_bindgen]
pub fn second_round(
    image_data: js_sys::Uint8ClampedArray,
    results: js_sys::Int32Array,
    args: &MandlebrotArgs,
    start_index: u32,
    amount: u32,
    lowest: u32,
) {
    let mut count: u32 = 0;
    let mut pixel: Pixel = index_to_pixel(start_index, &args);

    loop {
        let result: Option<u32>;
        let current = results.get_index(start_index + count);

        // normalize for lowest
        if current > 0 && lowest > 0 {
            let current_u = current as u32;
            result = Some(current_u - lowest + 1);
            draw_pixel(&pixel, result, &args, &image_data);
        }

        // TODO: check neighbors?

        
        if count >= amount {
            // log!("done after {}, count is {}", pixel, count);
            break;
        } else {
            count += 1;

            pixel = index_to_pixel(count + start_index, &args);
        }
    }
}

fn draw_pixel(
    pixel: &Pixel,
    iters_opt: Option<u32>,
    args: &MandlebrotArgs,
    arr: &js_sys::Uint8ClampedArray,
) {
    let index = ((args.width * pixel.y) + pixel.x) * 4;
    let (r, g, b): (u8, u8, u8);
    if let Some(iters) = iters_opt {
        let color = (f64::log2(iters as f64 * 1.2f64) / f64::log2(args.max_iterations as f64) * 255.0)
            .clamp(0f64, 255f64) as u8;
        // let color = ((iters as f64 / args.max_iterations as f64) * 255f64).clamp(0f64, 255f64) as u8;
        r = color / 2u8;
        g = 0u8;
        b = color / 3u8;
    } else {
        r = 255u8;
        g = 255u8;
        b = 255u8;
    }

    arr.set_index(index, r);
    arr.set_index(index + 1, g);
    arr.set_index(index + 2, b);
    arr.set_index(index + 3, 255u8); // alpha 100%
}

fn pixel_to_complex(pixel: &Pixel, args: &MandlebrotArgs) -> Complex {
    let real = ((pixel.x as f64 / args.width as f64) * (args.end.real - args.start.real))
        + args.start.real;

    // flip imag start and end because canvas y coords grows down
    let imag =
        ((pixel.y as f64 / args.height as f64) * (args.start.imag - args.end.imag)) + args.end.imag;
    return Complex { real, imag };
}

fn index_to_pixel(index: u32, args: &MandlebrotArgs) -> Pixel {
    let x = index % args.width;
    let y = index / args.width;
    return Pixel { x, y };
}