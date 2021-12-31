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
