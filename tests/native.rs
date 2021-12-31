#![feature(assert_matches)]

use std::assert_matches::assert_matches;

use fractals::check_in_mandlebrot;

const MAX_ITERATIONS: u32 = 100000u32;

#[test]
fn mandlebrot_member() {
    let pass = [
        (0f64, 0f64),
        (0f64, -1f64)
    ];
    
    for pair in pass {
        println!("({} + {}i should be in the mandlebrot set", pair.0, pair.1);
        assert_eq!(check_in_mandlebrot(pair.0, pair.1, MAX_ITERATIONS), None);
    }
}

#[test]
fn mandlebrot_not_member() {
    let fail = [
        (-2.1f64, 0f64),
        (0.26f64, 0f64)
    ];

    for pair in fail {
        println!("({} + {}i should not be in the mandlebrot set", pair.0, pair.1);
        assert_matches!(check_in_mandlebrot(pair.0, pair.1, MAX_ITERATIONS), Some(_));
    }
}