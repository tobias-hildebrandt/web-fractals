// import("../../pkg").then(wasm => {
//     self.addEventListener("message", message => {
//         console.log(`real worker sees message`);
//         // wasm.init();
//         // console.log(`worker sees ${message.data}`);
//         // // const args: fractals.MandlebrotArgs = null;
//         // const idNumber = message.data[0];


//         // console.log(`starting worker ${idNumber}`);
//         // const args = message.data[1];
//         // const pixelsPerBatch = message.data[2];

//         // const fakeImageDataArray = new Uint8ClampedArray(pixelsPerBatch * 4);
//         // const fakeResultsArray = new Int32Array(pixelsPerBatch);

//         // const min = wasm.render_mandlebrot(fakeImageDataArray, fakeResultsArray, args, idNumber * pixelsPerBatch, pixelsPerBatch);
//         // // const min = 1;
//         // postMessage([min, fakeImageDataArray, fakeResultsArray]);
//     });
// });

onmessage = message => {
    import("../../pkg").then(fractals => {
        // console.log(`real worker sees message!!!`);
        // fractals.init();
        // console.log(`worker sees ${message.data}`);
        const idNumber: number = message.data[0];
        const pass: number = message.data[1];
        // console.log(`starting worker ${idNumber}`);
        const parsed = JSON.parse(message.data[2]);
        const args = new fractals.MandlebrotArgs(
            new fractals.Complex(parsed.start.real, parsed.start.imag),
            new fractals.Complex(parsed.end.real, parsed.end.imag),
            parsed.width,
            parsed.height,
            parsed.maxIterations,
            parsed.keepRatio,
        );
        const pixelsPerBatch: number = message.data[3];
        
        console.log(`worker ${idNumber} on pass ${pass}`);
        if (pass == 1) {
            const fakeImageDataArray = new Uint8ClampedArray(pixelsPerBatch * 4);
            const fakeResultsArray = new Int32Array(pixelsPerBatch);
            const min = fractals.render_mandlebrot(fakeImageDataArray, fakeResultsArray, args, idNumber * pixelsPerBatch, pixelsPerBatch);
            postMessage([idNumber, pass, fakeImageDataArray, fakeResultsArray, min]);
        } else if (pass == 2) {
            const theMin = message.data[4];
            const imageData = message.data[5];
            const results = message.data[6];
            fractals.second_round(imageData, results, args, idNumber * pixelsPerBatch, pixelsPerBatch, theMin);
            postMessage([idNumber, pass, imageData]);
        }
    });
}

onerror = e => {
    console.log(`worker encountered error: ${e}`);
}