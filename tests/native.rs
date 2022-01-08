#![feature(assert_matches)]

use std::assert_matches::assert_matches;

use wasm_fractals::check_in_mandelbrot;

const MAX_ITERATIONS: u32 = 100000u32;

#[test]
fn mandelbrot_member() {
    let pass = [
        (0f64, 0f64),
        (0f64, -1f64)
    ];
    
    for pair in pass {
        println!("({} + {}i should be in the mandelbrot set", pair.0, pair.1);
        assert_eq!(check_in_mandelbrot(pair.0, pair.1, MAX_ITERATIONS), None);
    }
}

#[test]
fn mandelbrot_not_member() {
    let fail = [
        (-2.1f64, 0f64),
        (0.26f64, 0f64)
    ];

    for pair in fail {
        println!("({} + {}i should not be in the mandelbrot set", pair.0, pair.1);
        assert_matches!(check_in_mandelbrot(pair.0, pair.1, MAX_ITERATIONS), Some(_));
    }
}